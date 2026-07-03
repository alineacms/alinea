/**
 * Benchmark: current LocalDB/EntryResolver vs EntryDocIndex/EntryDocResolver.
 *
 * Run with: bun src/core/db/EntryDocBench.ts [entryCount]
 */
import {Entry} from '#/core.js'
import {Config, Field, Query} from '#/index.js'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {createRecord} from '../EntryRecord.js'
import type {Filter} from '../Filter.js'
import {DocDB} from '../docdb/DocDB.js'
import {hashBlob} from '../source/GitUtils.js'
import {MemorySource} from '../source/MemorySource.js'
import {ReadonlyTree} from '../source/Tree.js'
import type {TextDoc} from '../TextDoc.js'
import {createEntryDocOptions, EntryDocIndex} from './EntryDocIndex.js'
import {EntryDocResolver} from './EntryDocResolver.js'
import {LocalDB} from './LocalDB.js'

const ENTRY_COUNT = Number(process.argv[2] ?? 3000)
const ROOT_COUNT = 20
const MAX_DEPTH = 3
const LINKS_PER_ENTRY = 2
const CATEGORIES = Array.from({length: 10}, (_, i) => `category-${i}`)
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

interface Timing {
  total: number
  perOp: number
  ops: number
}

interface Result {
  name: string
  current: Timing
  entryDoc: Timing
}

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
      category: pick(CATEGORIES),
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

async function measure(
  ops: number,
  run: (i: number) => unknown | Promise<unknown>
): Promise<Timing> {
  for (let i = 0; i < Math.min(5, ops); i++) await run(i)
  const start = performance.now()
  for (let i = 0; i < ops; i++) await run(i)
  const total = performance.now() - start
  return {total, perOp: total / ops, ops}
}

function fmt(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  if (ms >= 1) return `${ms.toFixed(2)}ms`
  return `${(ms * 1000).toFixed(1)}us`
}

function pad(value: string, width: number): string {
  return value.padEnd(width)
}

function categoryFilter(category: string): Filter {
  return {category: {is: category}} as Filter
}

console.log(`Generating ${ENTRY_COUNT} entries...`)
const entries = generateEntries(ENTRY_COUNT)
const {source, jsonBytes} = await createSource(entries)
const sampleIds = Array.from(
  {length: 500},
  () => entries[Math.floor(random() * entries.length)].id
)
const parentsWithChildren = [
  ...new Set(
    entries.filter(entry => entry.parent).map(entry => entry.parent as string)
  )
]
const searchTerms = Array.from({length: 50}, () => pick(WORDS))

console.log('Booting current LocalDB...')
const currentBootStart = performance.now()
const current = new LocalDB(config, source)
await current.sync()
const currentBoot = performance.now() - currentBootStart

console.log('Booting EntryDocIndex...')
const entryDocBootStart = performance.now()
const backing = new Database(':memory:')
const docs = new DocDB(connect(backing), createEntryDocOptions(config))
const entryDocIndex = new EntryDocIndex(config, docs)
await entryDocIndex.syncWith(source)
const entryDocResolver = new EntryDocResolver(config, entryDocIndex)
const entryDocBoot = performance.now() - entryDocBootStart

const serializeStart = performance.now()
const image = backing.serialize()
const serialize = performance.now() - serializeStart
const hydrateStart = performance.now()
const restoredDocs = new DocDB(
  connect(Database.deserialize(image)),
  createEntryDocOptions(config)
)
const restoredIndex = new EntryDocIndex(config, restoredDocs)
await restoredIndex.hydrateTreeFromDocs()
const restoredResolver = new EntryDocResolver(config, restoredIndex)
await restoredResolver.resolve({
  id: entries[0].id,
  first: true,
  select: Entry.id
})
const hydrate = performance.now() - hydrateStart

const results = Array<Result>()

async function compare(
  name: string,
  ops: number,
  runCurrent: (i: number) => unknown | Promise<unknown>,
  runEntryDoc: (i: number) => unknown | Promise<unknown>
): Promise<void> {
  results.push({
    name,
    current: await measure(ops, runCurrent),
    entryDoc: await measure(ops, runEntryDoc)
  })
}

await compare(
  'id first + title',
  500,
  i =>
    current.first({
      id: sampleIds[i % sampleIds.length],
      select: Page.title
    }),
  i =>
    entryDocResolver.resolve({
      id: sampleIds[i % sampleIds.length],
      first: true,
      select: Page.title
    })
)

await compare(
  'children edge ids',
  200,
  i =>
    current.first({
      id: parentsWithChildren[i % parentsWithChildren.length],
      select: Query.children({select: Entry.id})
    }),
  i =>
    entryDocResolver.resolve({
      id: parentsWithChildren[i % parentsWithChildren.length],
      first: true,
      select: Query.children({select: Entry.id})
    })
)

await compare(
  'filter category',
  50,
  i =>
    current.find({
      type: Page,
      filter: categoryFilter(CATEGORIES[i % CATEGORIES.length]),
      select: Entry.id
    }),
  i =>
    entryDocResolver.resolve({
      type: Page,
      filter: categoryFilter(CATEGORIES[i % CATEGORIES.length]),
      select: Entry.id
    })
)

await compare(
  'search take 100',
  50,
  i => current.find({search: searchTerms[i % searchTerms.length], take: 100}),
  i =>
    entryDocResolver.resolve({
      search: searchTerms[i % searchTerms.length],
      take: 100,
      select: Entry.id
    })
)

await compare(
  'referencesTo',
  100,
  i => current.referencesTo({targetId: sampleIds[i % sampleIds.length]}),
  i => entryDocIndex.referencesTo({targetId: sampleIds[i % sampleIds.length]})
)

console.log(`\n== dataset: ${ENTRY_COUNT} entries ==`)
console.log(`content json:        ${(jsonBytes / 1024 / 1024).toFixed(2)} MB`)
console.log(
  `sqlite image:        ${(image.byteLength / 1024 / 1024).toFixed(2)} MB`
)
console.log('\n== one-time costs ==')
console.log(`current sync:                 ${fmt(currentBoot)}`)
console.log(`entrydoc sync into sqlite:     ${fmt(entryDocBoot)}`)
console.log(`entrydoc serialize sqlite:     ${fmt(serialize)}`)
console.log(`entrydoc hydrate sqlite image: ${fmt(hydrate)}`)
console.log('\n== queries (per operation) ==')
console.log(
  `${pad('benchmark', 24)}${pad('current', 12)}${pad('entrydoc', 12)}ratio`
)
for (const {name, current, entryDoc} of results) {
  console.log(
    `${pad(name, 24)}${pad(fmt(current.perOp), 12)}${pad(
      fmt(entryDoc.perOp),
      12
    )}${(current.perOp / entryDoc.perOp).toFixed(2)}x`
  )
}
