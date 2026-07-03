/**
 * Benchmark: DocDB (sqlite backed) vs the current in-memory entry engine.
 *
 * Run with: bun src/core/docdb/bench.ts [entryCount]
 *
 * Both engines are fed the same synthetic content tree. The current engine
 * boots by parsing entry JSON files and building its in-memory graph, DocDB
 * boots by deserializing a prebuilt sqlite image.
 */
import {LocalDB} from '#/core/db/LocalDB.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import type {TextDoc} from '#/core/TextDoc.js'
import {Config, Field} from '#/index.js'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {DocDB, type DocDBOptions, scanLinks} from './DocDB.js'

const ENTRY_COUNT = Number(process.argv[2] ?? 5000)
const ROOT_COUNT = 20
const MAX_DEPTH = 3
const LINKS_PER_ENTRY = 2
const CATEGORIES = Array.from({length: 10}, (_, i) => `category-${i}`)
const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod ' +
  'tempor incididunt labore dolore magna aliqua enim minim veniam quis ' +
  'nostrud exercitation ullamco laboris nisi aliquip commodo consequat'
).split(' ')

// deterministic PRNG so both engines see identical data across runs
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = mulberry32(42)
const pick = <T>(items: Array<T>): T =>
  items[Math.floor(random() * items.length)]
const words = (count: number) =>
  Array.from({length: count}, () => pick(WORDS)).join(' ')

// ---------------------------------------------------------------------------
// Synthetic dataset
// ---------------------------------------------------------------------------

interface BenchEntry {
  id: string
  parent: string | null
  index: string
  title: string
  path: string
  category: string
  weight: number
  body: TextDoc
  links: Array<string>
  filePath: string
  level: number
}

function generateEntries(count: number): Array<BenchEntry> {
  const entries: Array<BenchEntry> = []
  const parentPath = new Map<string, string>()
  for (let i = 0; i < count; i++) {
    const id = `entry-${i}`
    let parent: BenchEntry | null = null
    if (i >= ROOT_COUNT) {
      do {
        parent = entries[Math.floor(random() * entries.length)]
      } while (parent.level >= MAX_DEPTH)
    }
    const links: Array<string> = []
    if (i > 10) {
      for (let l = 0; l < LINKS_PER_ENTRY; l++) {
        links.push(`entry-${Math.floor(random() * i)}`)
      }
    }
    const title = `${words(3)} ${i}`
    const path = `page-${i}`
    const dir = parent
      ? `${parentPath.get(parent.id)}/${path}`
      : `pages/${path}`
    parentPath.set(id, dir)
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
      index: `a${i.toString(36).padStart(4, '0')}`,
      title,
      path,
      category: pick(CATEGORIES),
      weight: Math.floor(random() * 1000),
      body,
      links,
      filePath: `${dir}.json`,
      level: parent ? parent.level + 1 : 0
    })
  }
  return entries
}

// ---------------------------------------------------------------------------
// Current engine setup
// ---------------------------------------------------------------------------

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

async function createSource(entries: Array<BenchEntry>) {
  const source = new MemorySource()
  const encoder = new TextEncoder()
  let jsonBytes = 0
  const changes = await Promise.all(
    entries.map(async entry => {
      const record = {
        _id: entry.id,
        _type: 'Page',
        _index: entry.index,
        ...(entry.parent ? {} : {_root: 'pages'}),
        title: entry.title,
        category: entry.category,
        weight: entry.weight,
        body: entry.body
      }
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

// ---------------------------------------------------------------------------
// DocDB setup
// ---------------------------------------------------------------------------

const docOptions: DocDBOptions = {
  extractLinks(data) {
    return scanLinks(data, value => {
      if (typeof value._entry === 'string') return value._entry
    })
  },
  searchableText(data) {
    let body = ''
    for (const {id} of scanLinks(data, value => {
      if (typeof value.text === 'string') body += ` ${value.text}`
      return undefined
    }))
      void id
    return {title: data.title as string, body}
  },
  indexPaths: ['type', 'category', 'weight']
}

function toDoc(entry: BenchEntry) {
  return {
    id: entry.id,
    parent: entry.parent,
    data: {
      type: 'Page',
      title: entry.title,
      path: entry.path,
      category: entry.category,
      weight: entry.weight,
      body: entry.body
    }
  }
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

interface Timing {
  total: number
  perOp: number
  ops: number
}

async function measure(
  ops: number,
  run: (i: number) => unknown | Promise<unknown>
): Promise<Timing> {
  // warmup
  for (let i = 0; i < Math.min(3, ops); i++) await run(i)
  const start = performance.now()
  for (let i = 0; i < ops; i++) await run(i)
  const total = performance.now() - start
  return {total, perOp: total / ops, ops}
}

const results: Array<{name: string; current?: Timing; docdb?: Timing}> = []
function report(name: string, current: Timing | undefined, docdb: Timing) {
  results.push({name, current, docdb})
}

function fmt(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  if (ms >= 1) return `${ms.toFixed(2)}ms`
  return `${(ms * 1000).toFixed(1)}µs`
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

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
const linkTargets = [...new Set(entries.flatMap(entry => entry.links))]
const linkBatches = Array.from({length: 20}, (_, i) => {
  const start = (i * 97) % Math.max(1, linkTargets.length - 100)
  return linkTargets.slice(start, start + 100)
})

// --- current engine --------------------------------------------------------

console.log('Booting current engine (EntryIndex)...')
const bootCurrentStart = performance.now()
const current = new LocalDB(config, source)
await current.sync()
const bootCurrent = performance.now() - bootCurrentStart

const currentById = await measure(500, i =>
  current.first({id: sampleIds[i % sampleIds.length]})
)
const currentChildren = await measure(200, i =>
  current.find({parentId: parentsWithChildren[i % parentsWithChildren.length]})
)
const currentFilter = await measure(50, i =>
  current.find({
    type: config.schema.Page,
    filter: {category: {is: CATEGORIES[i % CATEGORIES.length]}}
  })
)
const currentSearch = await measure(50, i =>
  current.find({search: searchTerms[i % searchTerms.length], take: 100})
)
const refBuildStart = performance.now()
await current.index.references
const currentRefBuild = performance.now() - refBuildStart
const currentRefsTo = await measure(100, i =>
  current.referencesTo({targetId: sampleIds[i % sampleIds.length]})
)
const currentLinkWave = await measure(20, i =>
  current.find({id: {in: linkBatches[i % linkBatches.length]}})
)

// --- docdb ------------------------------------------------------------------

console.log('Ingesting into DocDB...')
const ingestStart = performance.now()
const backing = new Database(':memory:')
const writer = new DocDB(connect(backing), docOptions)
writer.insert(entries.map(toDoc))
const docIngest = performance.now() - ingestStart

const serializeStart = performance.now()
const image = backing.serialize()
const docSerialize = performance.now() - serializeStart

console.log('Booting DocDB from sqlite image...')
const bootDocStart = performance.now()
const docdb = new DocDB(connect(Database.deserialize(image)), docOptions)
docdb.get(entries[0].id) // first query included in boot
const bootDoc = performance.now() - bootDocStart

const docById = await measure(500, i =>
  docdb.get(sampleIds[i % sampleIds.length])
)
const docChildren = await measure(200, i =>
  docdb.query({parent: parentsWithChildren[i % parentsWithChildren.length]})
)
const docFilter = await measure(50, i =>
  docdb.query({
    where: {
      and: [
        {path: 'type', eq: 'Page'},
        {path: 'category', eq: CATEGORIES[i % CATEGORIES.length]}
      ]
    }
  })
)
const docSearch = await measure(50, i =>
  docdb.query({search: searchTerms[i % searchTerms.length], take: 100})
)
const docRefsTo = await measure(100, i =>
  docdb.referencesTo(sampleIds[i % sampleIds.length])
)
const docLinkWave = await measure(20, i =>
  docdb.getMany(linkBatches[i % linkBatches.length])
)
const docDescendants = await measure(50, i =>
  docdb.query({descendantOf: entries[i % ROOT_COUNT].id})
)

// --- results ----------------------------------------------------------------

report('get by id (x500)', currentById, docById)
report('children of parent (x200)', currentChildren, docChildren)
report('filter type+category (x50)', currentFilter, docFilter)
report('search (x50)', currentSearch, docSearch)
report('referencesTo (x100)', currentRefsTo, docRefsTo)
report('link batch of 100 (x20)', currentLinkWave, docLinkWave)
report('descendants of root (x50)', undefined, docDescendants)

console.log(`\n== dataset: ${ENTRY_COUNT} entries ==`)
console.log(`content json:        ${(jsonBytes / 1024 / 1024).toFixed(2)} MB`)
console.log(
  `sqlite image:        ${(image.byteLength / 1024 / 1024).toFixed(2)} MB`
)
console.log('\n== one-time costs ==')
console.log(`current boot (parse + index):   ${fmt(bootCurrent)}`)
console.log(`current reference index build:  ${fmt(currentRefBuild)}`)
console.log(`docdb ingest (write everything):${fmt(docIngest)}`)
console.log(`docdb serialize image:          ${fmt(docSerialize)}`)
console.log(`docdb boot from image:          ${fmt(bootDoc)}`)
console.log('\n== queries (per operation) ==')
const pad = (value: string, width: number) => value.padEnd(width)
console.log(
  `${pad('benchmark', 30)}${pad('current', 12)}${pad('docdb', 12)}speedup`
)
for (const {name, current, docdb} of results) {
  const speedup = current
    ? `${(current.perOp / docdb!.perOp).toFixed(1)}x`
    : '-'
  console.log(
    `${pad(name, 30)}${pad(current ? fmt(current.perOp) : '-', 12)}${pad(
      fmt(docdb!.perOp),
      12
    )}${speedup}`
  )
}
