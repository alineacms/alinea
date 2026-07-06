/**
 * Benchmark: file-backed EntryIndex loading for apps/dev content.
 *
 * Run with: bun src/core/db/EntryIndexFileBench.ts [contentDir]
 */
import fs from 'node:fs/promises'
import path from 'node:path/posix'
import {Config, Field} from 'alinea'
import type {Config as CoreConfig} from '../Config.js'
import {accumulate} from '../util/Async.js'
import {CachedFSSource, FSSource} from '../source/FSSource.js'
import {EntryIndex} from './EntryIndex.js'

const contentDir = process.argv[2] ?? 'apps/dev/content'

interface Timing<Result> {
  ms: number
  result: Result
}

async function timed<Result>(
  run: () => Result | Promise<Result>
): Promise<Timing<Result>> {
  const start = performance.now()
  const result = await run()
  return {ms: performance.now() - start, result}
}

function fmt(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  if (ms >= 1) return `${ms.toFixed(2)}ms`
  return `${(ms * 1000).toFixed(1)}us`
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function collectFiles(dir: string): Promise<Array<string>> {
  const result = Array<string>()
  const entries = await fs.readdir(dir, {recursive: true})
  await Promise.all(
    entries.map(async entry => {
      const file = String(entry).replace(/\\/g, '/')
      const fullPath = path.join(dir, file)
      const stat = await fs.stat(fullPath).catch(() => undefined)
      if (stat?.isFile()) result.push(file)
    })
  )
  return result.sort()
}

async function collectTypes(dir: string, files: Array<string>): Promise<Array<string>> {
  const types = new Set<string>()
  await Promise.all(
    files.map(async file => {
      if (!file.endsWith('.json')) return
      const raw = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'))
      if (typeof raw._type === 'string') types.add(raw._type)
    })
  )
  return [...types].sort()
}

function createBenchmarkConfig(types: Array<string>) {
  const customTypes = types.filter(type => {
    return type !== 'MediaFile' && type !== 'MediaLibrary'
  })
  const schema = Object.fromEntries(
    customTypes.map(type => {
      return [
        type,
        Config.document(type, {
          contains: types,
          fields: {
            title: Field.text('Title'),
            path: Field.path('Path')
          }
        })
      ]
    })
  )
  return Config.create({
    schema,
    workspaces: {
      primary: Config.workspace('Primary workspace', {
        source: 'content/primary',
        roots: {
          fields: Config.root('Fields', {contains: types}),
          pages: Config.root('Languages', {
            contains: types,
            i18n: {locales: ['en', 'fr', 'nl-BE', 'nl-NL']}
          }),
          custom: Config.root('Custom', {contains: types}),
          media: Config.root('Media', {contains: types})
        }
      }),
      secondary: Config.workspace('Secondary workspace', {
        source: 'content/secondary',
        roots: {
          pages: Config.root('Pages', {contains: types})
        }
      })
    }
  })
}

async function benchmarkSource(
  label: string,
  source: FSSource,
  config: CoreConfig
) {
  const tree = await timed(() => source.getTree())
  const batch = tree.result.diff(tree.result)
  const index = new EntryIndex(config)
  const sync = await timed(() => index.syncWith(source))
  const warmTree = await timed(() => source.getTree())
  return {
    label,
    tree: tree.ms,
    sync: sync.ms,
    warmTree: warmTree.ms,
    files: Array.from(tree.result).filter(([, node]) => node.type === 'blob')
      .length,
    noopChanges: batch.changes.length
  }
}

const files = await collectFiles(contentDir)
const types = await collectTypes(contentDir, files)
const bytes = (
  await Promise.all(
    files.map(async file => {
      return (await fs.stat(path.join(contentDir, file))).size
    })
  )
).reduce((sum, size) => sum + size, 0)
const config = createBenchmarkConfig(types)

const refreshSource = new CachedFSSource(contentDir)
const refresh = await timed(() => refreshSource.refresh())

const plain = await benchmarkSource('FSSource', new FSSource(contentDir), config)
const cached = await benchmarkSource(
  'CachedFSSource',
  new CachedFSSource(contentDir),
  config
)

console.log(`\n== file dataset: ${contentDir} ==`)
console.log(`files: ${files.length}`)
console.log(`types: ${types.length}`)
console.log(`bytes: ${mb(bytes)}`)
console.log('\n== dev refresh ==')
console.log(`CachedFSSource.refresh(): ${fmt(refresh.ms)}`)
console.log('\n== source/index phases ==')
for (const result of [plain, cached]) {
  console.log(`${result.label}`)
  console.log(`  getTree:      ${fmt(result.tree)}`)
  console.log(`  index sync:   ${fmt(result.sync)}`)
  console.log(`  warm getTree: ${fmt(result.warmTree)}`)
}
