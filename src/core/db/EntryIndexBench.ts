/**
 * Benchmark: current EntryIndex cold start and memory usage.
 *
 * Run with: bun src/core/db/EntryIndexBench.ts [entryCount]
 */
import {Config, Field} from 'alinea'
import {Entry} from 'alinea/core'
import {createRecord} from '../EntryRecord.js'
import {hashBlob} from '../source/GitUtils.js'
import {MemorySource} from '../source/MemorySource.js'
import {ReadonlyTree} from '../source/Tree.js'
import type {TextDoc} from '../TextDoc.js'
import {EntryIndex} from './EntryIndex.js'
import {EntryResolver} from './EntryResolver.js'

const ENTRY_COUNT = Number(process.argv[2] ?? 5000)
const ROOT_COUNT = 20
const MAX_DEPTH = 3
const LINKS_PER_ENTRY = 2
const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod ' +
  'tempor incididunt labore dolore magna aliqua enim minim veniam quis ' +
  'nostrud exercitation ullamco laboris nisi aliquip commodo consequat'
).split(' ')

interface BenchEntry {
  id: string
  parent: string | null
  parentPaths: Array<string>
  index: string
  title: string
  path: string
  category: string
  weight: number
  body: TextDoc
  filePath: string
  level: number
}

interface MemorySnapshot {
  heapUsed: number
  rss: number
}

interface Timed<Result> {
  ms: number
  result: Result
}

const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    category: Field.text('Category'),
    weight: Field.number('Weight'),
    body: Field.richText('Body', {searchable: true})
  }
})

const config = Config.create({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages', {contains: ['Page']})}
    })
  }
})

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(42)

function pick<T>(items: Array<T>): T {
  return items[Math.floor(random() * items.length)]
}

function words(count: number): string {
  return Array.from({length: count}, () => pick(WORDS)).join(' ')
}

function generateEntries(count: number): Array<BenchEntry> {
  const entries = Array<BenchEntry>()
  for (let i = 0; i < count; i++) {
    const id = `entry-${i}`
    let parent: BenchEntry | null = null
    if (i >= ROOT_COUNT) {
      do {
        parent = entries[Math.floor(random() * entries.length)]
      } while (parent.level >= MAX_DEPTH)
    }
    const links = Array<string>()
    if (i > 10) {
      for (let l = 0; l < LINKS_PER_ENTRY; l++) {
        links.push(`entry-${Math.floor(random() * i)}`)
      }
    }
    const path = `page-${i}`
    const parentPaths = parent ? [...parent.parentPaths, parent.path] : []
    const body: TextDoc = Array.from({length: 3}, (_, p) => ({
      _type: 'paragraph',
      content: [
        {_type: 'text' as const, text: words(20)},
        ...(p < links.length
          ? [
              {
                _type: 'text' as const,
                text: words(2),
                marks: [
                  {
                    _type: 'link',
                    _id: `link-${i}-${p}`,
                    _link: 'entry' as const,
                    _entry: links[p]
                  }
                ]
              }
            ]
          : [])
      ]
    }))
    entries.push({
      id,
      parent: parent?.id ?? null,
      parentPaths,
      index: `a${i.toString(36).padStart(4, '0')}`,
      title: `${words(3)} ${i}`,
      path,
      category: `category-${i % 10}`,
      weight: Math.floor(random() * 1000),
      body,
      filePath: `pages/${[...parentPaths, path].join('/')}.json`,
      level: parent ? parent.level + 1 : 0
    })
  }
  return entries
}

async function createSource(entries: Array<BenchEntry>): Promise<{
  source: MemorySource
  jsonBytes: number
}> {
  const source = new MemorySource()
  const encoder = new TextEncoder()
  let jsonBytes = 0
  const changes = await Promise.all(
    entries.map(async entry => {
      const record = createRecord(
        {
          id: entry.id,
          type: 'Page',
          index: entry.index,
          parentId: entry.parent,
          root: 'pages',
          path: entry.path,
          title: entry.title,
          seeded: null,
          data: {
            title: entry.title,
            path: entry.path,
            category: entry.category,
            weight: entry.weight,
            body: entry.body
          }
        },
        'published'
      )
      const contents = encoder.encode(JSON.stringify(record, null, 2))
      jsonBytes += contents.byteLength
      return {
        op: 'add' as const,
        path: entry.filePath,
        sha: await hashBlob(contents),
        contents
      }
    })
  )
  await source.applyChanges({fromSha: ReadonlyTree.EMPTY.sha, changes})
  return {source, jsonBytes}
}

async function timed<Result>(
  run: () => Result | Promise<Result>
): Promise<Timed<Result>> {
  const start = performance.now()
  const result = await run()
  return {ms: performance.now() - start, result}
}

function gc(): void {
  Bun.gc(true)
}

function memory(): MemorySnapshot {
  gc()
  const usage = process.memoryUsage()
  return {heapUsed: usage.heapUsed, rss: usage.rss}
}

function diffMemory(after: MemorySnapshot, before: MemorySnapshot): MemorySnapshot {
  return {
    heapUsed: after.heapUsed - before.heapUsed,
    rss: after.rss - before.rss
  }
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function fmt(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  if (ms >= 1) return `${ms.toFixed(2)}ms`
  return `${(ms * 1000).toFixed(1)}us`
}

console.log(`Generating ${ENTRY_COUNT} entries...`)
const generated = await timed(() => createSource(generateEntries(ENTRY_COUNT)))
const {source, jsonBytes} = generated.result
const afterSource = memory()

console.log('Indexing EntryIndex...')
const index = new EntryIndex(config)
const beforeIndex = memory()
const sync = await timed(() => index.syncWith(source))
const afterIndex = memory()
const resolver = new EntryResolver(config, index)

const firstSearch = await timed(() => {
  return resolver.resolve({
    search: 'lorem',
    take: 100,
    select: Entry.id
  })
})
const afterSearch = memory()
const secondSearch = await timed(() => {
  return resolver.resolve({
    search: 'lorem',
    take: 100,
    select: Entry.id
  })
})
const afterCachedSearch = memory()

console.log(`\n== dataset: ${ENTRY_COUNT} entries ==`)
console.log(`content json: ${mb(jsonBytes)}`)
console.log(`source build: ${fmt(generated.ms)}`)
console.log('\n== cold index ==')
console.log(`sync:        ${fmt(sync.ms)}`)
console.log(`heap delta:  ${mb(diffMemory(afterIndex, beforeIndex).heapUsed)}`)
console.log(`rss delta:   ${mb(diffMemory(afterIndex, beforeIndex).rss)}`)
console.log('\n== lazy indexes ==')
console.log(`first search:      ${fmt(firstSearch.ms)}`)
console.log(`second search:     ${fmt(secondSearch.ms)}`)
console.log('\n== retained memory deltas ==')
console.log(`after source heap:      ${mb(afterSource.heapUsed)}`)
console.log(
  `after index heap delta: ${mb(diffMemory(afterIndex, afterSource).heapUsed)}`
)
console.log(
  `after search heap delta: ${mb(diffMemory(afterSearch, afterIndex).heapUsed)}`
)
console.log(
  `cached search heap delta: ${mb(
    diffMemory(afterCachedSearch, afterSearch).heapUsed
  )}`
)
