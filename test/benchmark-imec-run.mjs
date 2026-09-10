import {readFile, writeFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {Database} from 'bun:sqlite'

const [project, scratch, engine, trial = '1'] = process.argv.slice(2)
const start = performance.now()
const {cms} = await import(scratch + '/config.mjs')
const {Entry} = await import(
  project + '/node_modules/alinea/dist/core/Entry.js'
)
const {Query} = await import(project + '/node_modules/alinea/dist/index.js')
const api = await import(scratch + '/' + engine + '.mjs')
const moduleMs = performance.now() - start
const config = cms.config
let resolver,
  close = () => {},
  setup = {},
  rows
const setupStart = performance.now()
if (engine === 'installed' || engine === 'sync') {
  const old = await import(scratch + '/installed.mjs')
  const fs = new old.FSSource(project + '/content')
  const original = await fs.getTree()
  const builder = new old.WriteableTree()
  for (const [name, node] of original)
    if (node.type !== 'tree') builder.add(name, node.sha)
  const tree = await builder.compile()
  const source = {
    async getTree() {
      return tree
    },
    async getTreeIfDifferent(sha) {
      return sha === tree.sha ? undefined : tree
    },
    getBlobs(shas) {
      return fs.getBlobs(shas)
    },
    applyChanges() {
      throw new Error('Read-only benchmark')
    }
  }
  setup.sourceTreeMs = performance.now() - setupStart
  if (engine === 'installed') {
    const index = new api.EntryIndex(config)
    await index.syncWith(source)
    resolver = new api.EntryResolver(config, index)
    rows = Array.from(index.filter({}))
    await writeFile(scratch + '/rows.json', JSON.stringify(rows))
    setup.rows = rows.length
    setup.dataBytes = Buffer.byteLength(
      JSON.stringify(rows.map(row => row.data))
    )
  } else {
    const release = await api.exportRuntimeDatabase({
      config,
      source,
      bundleId: 'bench',
      bundleUrl: 'memory:bench',
      compression: 'none'
    })
    const openStart = performance.now()
    const store = new api.RuntimeEntryStore({
      index: release.index,
      source: () => new api.MemoryRangeSource(release.bundle)
    })
    resolver = new api.DatabaseResolver(config, store)
    setup.storeConstructionMs = performance.now() - openStart
    setup.bundleBytes = release.bundle.byteLength
    setup.indexBytes = Buffer.byteLength(JSON.stringify(release.index))
  }
} else {
  rows = JSON.parse(await readFile(scratch + '/rows.json', 'utf8'))
  const file = scratch + '/query-' + trial + '.sqlite'
  let db
  if (engine === 'sqlite') {
    const sqlite = new Database(file, {create: true})
    db = api.connect(sqlite)
    await api.EntryRuntime.createSchema(db, 'benchmark')
    await new api.EntryRuntime(config, db).apply({
      fromRevision: 'benchmark',
      toRevision: 'ready',
      entries: rows.map((row, ordinal) => ({
        entry: {...row, versionStatus: row.status, ordinal},
        payloadId: row.fileHash || 'seed',
        data: row.data,
        source: api.entrySource(row)
      }))
    })
    db.close()
    setup.materializeMs = performance.now() - setupStart
    const openStart = performance.now()
    db = api.connect(new Database(file, {readonly: true}))
    setup.reopenMs = performance.now() - openStart
    setup.databaseBytes = (await stat(file)).size
  } else {
    const openStart = performance.now()
    db = await api.wasmDatabase(new Uint8Array(await readFile(file)))
    setup.fullFileReadAndOpenMs = performance.now() - openStart
  }
  resolver = new api.EntryRuntime(config, db)
  close = () => db.close()
}
setup.totalMs = performance.now() - setupStart
rows ??= JSON.parse(await readFile(scratch + '/rows.json', 'utf8'))
const parentIds = new Set(rows.map(row => row.parentId))
const target =
  rows.find(
    row => row.type === 'Page' && row.locale === 'en' && parentIds.has(row.id)
  ) ?? rows[0]
const card = {id: Entry.id, title: Entry.title, url: Entry.url}
const {Page, Home, Article} = config.schema
const nav = {url: Query.url, title: Query.title, navigation: Page.navigation}
const cases = [
  // Navigation.tsx loadNavigationRoots/loadNavigationHome/navigationIncludeQuery.
  [
    'imec-navigation-roots',
    {
      workspace: 'international',
      root: 'pages',
      locale: 'en',
      level: 0,
      select: nav
    }
  ],
  [
    'imec-navigation-home',
    {
      workspace: 'international',
      root: 'pages',
      locale: 'en',
      type: Home,
      first: true,
      select: {url: Query.url, title: Query.title}
    }
  ],
  [
    'imec-navigation-nested',
    {
      id: target.id,
      locale: 'en',
      first: true,
      select: {
        url: Query.url,
        parent: Query.parent({
          select: {
            blocks: Page.blocks,
            parent: Query.parent({select: nav}),
            ...nav,
            children: Query.children({select: nav})
          }
        }),
        children: Query.children({select: nav})
      }
    }
  ],
  // Articles.tsx / ArticleCard.tsx / articleCardData.ts, international/all types.
  [
    'imec-article-cards',
    {
      root: 'collections',
      locale: 'en',
      type: Article,
      filter: {visibility: {includes: 'international'}},
      orderBy: {desc: Article.publicationDate},
      take: 15,
      select: {
        _id: Query.id,
        _url: Query.url,
        _type: Query.type,
        title: Query.title,
        hero: Article.hero,
        tags: Article.tags,
        publicationDate: Article.publicationDate,
        articleType: Article.articleType,
        publicationImage: Article.publicationImage,
        label: Article.label,
        authors: Article.authors.find({select: {title: Query.title}})
      }
    }
  ],
  ['id-card', {id: target.id, locale: target.locale, select: card}],
  ['url-card', {url: target.url, locale: target.locale, select: card}],
  ['page-20', {select: card, orderBy: Entry.id, take: 20}],
  ['deep-page-20', {select: card, orderBy: Entry.id, skip: 5000, take: 20}],
  [
    'type-page-20',
    {type: config.schema.Page, select: card, orderBy: Entry.id, take: 20}
  ],
  ['children', {parentId: target.id, select: card, orderBy: Entry.id}],
  ['all-ids', {select: Entry.id, orderBy: Entry.id}],
  [
    'content-filter',
    {
      type: config.schema.Page,
      filter: {title: {startsWith: 'A'}},
      select: card,
      orderBy: Entry.id,
      take: 20
    }
  ],
  ['full-entry', {id: target.id, locale: target.locale, select: Entry}],
  [
    'full-page-20',
    {type: config.schema.Page, select: Entry, orderBy: Entry.id, take: 20}
  ]
]
// Explicit directions are required by the installed patched resolver.
for (const [, query] of cases)
  if (query.orderBy === Entry.id) query.orderBy = {asc: Entry.id}
// Separate diagnostic cases: do not silently change the original query's
// default natural string ordering just to obtain matching results.
for (const name of [
  'page-20',
  'deep-page-20',
  'type-page-20',
  'children',
  'all-ids',
  'content-filter',
  'full-page-20'
]) {
  const [, query] = cases.find(([key]) => key === name)
  cases.push([
    name + '-binary',
    {...query, orderBy: {asc: Entry.id, caseSensitive: true}}
  ])
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonical(value[key])])
    )
  return value
}
const results = []
for (const [name, query] of cases) {
  try {
    const t = performance.now()
    const value = await resolver.resolve(query)
    const firstMs = performance.now() - t
    const serialized = JSON.stringify(canonical(value))
    await writeFile(
      scratch + '/' + engine + '-' + name + '-value.json',
      serialized
    )
    for (let i = 0; i < 5; i++) await resolver.resolve(query)
    const samples = []
    for (let i = 0; i < 30; i++) {
      const t = performance.now()
      await resolver.resolve(query)
      samples.push(performance.now() - t)
    }
    samples.sort((a, b) => a - b)
    results.push({
      name,
      firstMs,
      medianMs: samples[15],
      p95Ms: samples[28],
      count: Array.isArray(value) ? value.length : 1,
      bytes: Buffer.byteLength(serialized),
      hash: createHash('sha256').update(serialized).digest('hex')
    })
  } catch (error) {
    results.push({name, error: error.message})
  }
}
close()
const result = {
  engine,
  trial,
  moduleMs,
  setup,
  memory: process.memoryUsage(),
  results
}
await writeFile(
  scratch + '/' + engine + '-results-' + trial + '.json',
  JSON.stringify(result, null, 2)
)
console.log(JSON.stringify(result, null, 2))
