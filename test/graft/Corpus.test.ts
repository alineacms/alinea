import {readdirSync, readFileSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {Config} from '#/core/Config.js'
import {entryCodec} from '#/core/graft/EntryCodec.js'
import {mergeEntryFiles} from '#/core/graft/MergeEntryFiles.js'
import {generateKeyBetween} from '#/core/util/FractionalIndexing.js'
import {isRecord} from '#/core/util/Objects.js'
import {suite} from '@alinea/suite'
import {type Corpus, corpora} from './AppConfigs.js'

const test = suite(import.meta)
const decoder = new TextDecoder()
const encoder = new TextEncoder()

interface ContentFile {
  path: string
  contents: Uint8Array
}

function filesIn(dir: string, prefix = ''): Array<ContentFile> {
  return readdirSync(join(dir, prefix)).flatMap(name => {
    const path = prefix ? `${prefix}/${name}` : name
    if (statSync(join(dir, path)).isDirectory()) return filesIn(dir, path)
    if (!name.endsWith('.json')) return []
    return [{path, contents: readFileSync(join(dir, path))}]
  })
}

function contentOf(corpus: Corpus): Array<ContentFile> {
  const dir = Config.contentDir(corpus.cms.config)
  return filesIn(corpus.dir, dir)
}

type Path = Array<string | number>

/** Paths of strings an editor writes: not ids, types, order keys or paths */
function editable(value: unknown, path: Path = []): Array<Path> {
  if (typeof value === 'string')
    return value.length > 0 && path.length > 0 ? [path] : []
  if (Array.isArray(value))
    return value.flatMap((item, index) => editable(item, [...path, index]))
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, inner]) =>
    key.startsWith('_') || key === 'path' || key === 'marks'
      ? []
      : editable(inner, [...path, key])
  )
}

function update(
  value: unknown,
  path: Path,
  change: (s: string) => string
): unknown {
  if (path.length === 0) return change(value as string)
  const [key, ...rest] = path
  if (Array.isArray(value))
    return value.map((item, index) =>
      index === key ? update(item, rest, change) : item
    )
  const record = value as Record<string, unknown>
  return {...record, [key]: update(record[key], rest, change)}
}

/** Lists of rows: arrays of objects with an id and an order key */
function rowLists(value: unknown, path: Path = []): Array<Path> {
  if (Array.isArray(value)) {
    const rows =
      value.length > 0 &&
      value.every(
        row =>
          isRecord(row) &&
          typeof row._id === 'string' &&
          typeof row._index === 'string' &&
          row._index !== ''
      )
    return [
      ...(rows ? [path] : []),
      ...value.flatMap((item, index) => rowLists(item, [...path, index]))
    ]
  }
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, inner]) =>
    rowLists(inner, [...path, key])
  )
}

function at(value: unknown, path: Path): unknown {
  return path.reduce<unknown>(
    (current, key) => (current as Record<string | number, unknown>)?.[key],
    value
  )
}

function set(value: unknown, path: Path, next: unknown): unknown {
  if (path.length === 0) return next
  const [key, ...rest] = path
  if (Array.isArray(value))
    return value.map((item, index) =>
      index === key ? set(item, rest, next) : item
    )
  const record = value as Record<string, unknown>
  return {...record, [key]: set(record[key], rest, next)}
}

function write(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value, null, '  '))
}

const all = await corpora()

test('every entry reads and writes back byte for byte', () => {
  let count = 0
  for (const corpus of all) {
    const codec = entryCodec(corpus.cms.config.schema)
    for (const file of contentOf(corpus)) {
      const value = codec.parse(file.contents)
      test.ok(value !== undefined)
      const written = codec.format(value!, file.contents)
      // The path names the file that fails
      test.equal(
        {path: file.path, text: decoder.decode(written)},
        {path: file.path, text: decoder.decode(file.contents)}
      )
      count++
    }
  }
  test.ok(count > 300)
})

test('edits to different parts of an entry merge', async () => {
  let merges = 0
  for (const corpus of all) {
    const config = corpus.cms.config
    const mergeFile = mergeEntryFiles(config)
    const codec = entryCodec(config.schema)
    for (const file of contentOf(corpus)) {
      const base = codec.parse(file.contents)!
      const paths = editable(base)
      const picks = [...new Set([0, paths.length >> 1, paths.length - 1])]
        .map(index => paths[index])
        .filter(Boolean)
      for (const [i, a] of picks.entries())
        for (const b of picks.slice(i + 1)) {
          const ours = update(base, a, s => `${s} (ours)`)
          const theirs = update(base, b, s => `(theirs) ${s}`)
          const expected = update(ours, b, s => `(theirs) ${s}`)
          for (const prefer of ['ours', 'theirs'] as const) {
            const merged = await mergeFile(
              {
                path: file.path,
                base: file.contents,
                ours: write(ours),
                theirs: write(theirs)
              },
              {prefer}
            )
            const label = `${file.path} ${a.join('.')} ${b.join('.')}`
            test.equal(
              {label, value: JSON.parse(decoder.decode(merged!))},
              {label, value: expected}
            )
            merges++
          }
        }
    }
  }
  test.ok(merges > 300)
})

test('a row edited on one side and a row added on the other merge', async () => {
  let merges = 0
  for (const corpus of all) {
    const config = corpus.cms.config
    const mergeFile = mergeEntryFiles(config)
    const codec = entryCodec(config.schema)
    for (const file of contentOf(corpus)) {
      const base = codec.parse(file.contents)!
      for (const list of rowLists(base)) {
        const rows = at(base, list) as Array<Record<string, unknown>>
        const last = rows.at(-1)!
        const added = {
          ...last,
          _id: 'added-row',
          _index: generateKeyBetween(last._index as string, null)
        }
        const theirs = set(base, list, [...rows, added])
        const edits = editable(rows[0]).map(path => [...list, 0, ...path])
        const ours = edits[0]
          ? update(base, edits[0], s => `${s} (ours)`)
          : base
        const expected = set(ours, list, [...(at(ours, list) as []), added])
        const merged = await mergeFile(
          {
            path: file.path,
            base: file.contents,
            ours: write(ours),
            theirs: write(theirs)
          },
          {prefer: 'ours'}
        )
        const label = `${file.path} ${list.join('.')}`
        test.equal(
          {label, value: JSON.parse(decoder.decode(merged!))},
          {label, value: expected}
        )
        merges++
      }
    }
  }
  test.ok(merges > 10)
})
