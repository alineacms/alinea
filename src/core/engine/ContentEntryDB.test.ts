import {suite} from '@alinea/suite'
import {Config, Field} from 'alinea'
import {Config as ConfigUtils, createConfig} from '../Config.js'
import {Entry} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import {EntryIndex} from '../db/EntryIndex.js'
import {hashBlob} from '../source/GitUtils.js'
import {MemorySource} from '../source/MemorySource.js'
import {ContentEntryDB} from './index.js'

const test = suite(import.meta)

const QueryArticle = Config.document('QueryArticle', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    body: Field.text('Body', {searchable: true}),
    score: Field.number('Score'),
    featured: Field.check('Featured')
  }
})

const config = createConfig({
  schema: {QueryArticle},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages', {contains: ['QueryArticle']})
      }
    })
  }
})

interface FixtureEntry {
  id: string
  index: string
  path: string
  title: string
  body: string
  score: number
  featured?: boolean
}

test('ContentEntryDB opens exported bytes and resolves selected fields', async () => {
  const db = await createDb([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 'cookie body', 10),
    entry('article-beta', 'a2', 'beta', 'Beta', 'plain body', 20)
  ])

  test.equal(
    await db.resolve({
      type: 'QueryArticle',
      filter: {score: {gte: 20}},
      select: {
        id: Entry.id,
        title: Entry.title,
        filePath: Entry.filePath,
        rowHash: Entry.rowHash,
        fileHash: Entry.fileHash
      },
      get: true
    } as any),
    {
      id: 'article-beta',
      title: 'Beta',
      filePath: 'pages/beta.json',
      rowHash: await fileHashFor(entry('article-beta', 'a2', 'beta', 'Beta', 'plain body', 20)),
      fileHash: await fileHashFor(entry('article-beta', 'a2', 'beta', 'Beta', 'plain body', 20))
    }
  )
})

test('ContentEntryDB keeps includes-based search over searchableText', async () => {
  const db = await createDb([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 'Cookie Body', 10),
    entry('article-beta', 'a2', 'beta', 'Beta', 'Plain Body', 20)
  ])

  test.equal(
    await db.resolve({
      search: ['cookie'],
      select: Entry.id
    } as any),
    ['article-alpha']
  )
})

test('ContentEntryDB reconstructs full public entries from underscored storage', async () => {
  const input = entry(
    'article-alpha',
    'a1',
    'alpha',
    'Alpha',
    'Cookie Body',
    10,
    true
  )
  const db = await createDb([input])
  const full = (await db.resolve({
    id: 'article-alpha',
    get: true
  } as any)) as any

  test.is(full.id, 'article-alpha')
  test.is(full.type, 'QueryArticle')
  test.is(full.filePath, 'pages/alpha.json')
  test.is(full.rowHash, full.fileHash)
  test.is(full.searchableText, 'Cookie Body')
  test.equal(full.data, {
    title: 'Alpha',
    path: 'alpha',
    body: 'Cookie Body',
    score: 10,
    featured: true
  })
  test.is(full._id, undefined)
})

test('ContentEntryDB syncWith builds, no-ops, and replaces changed content', async () => {
  const source = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 'Cookie Body', 10),
    entry('article-beta', 'a2', 'beta', 'Beta', 'Plain Body', 20)
  ])
  const db = new ContentEntryDB(config)
  const sha = await db.syncWith(source)

  test.is(db.sha, sha)
  test.equal(
    await db.resolve({
      type: 'QueryArticle',
      orderBy: {asc: Entry.title},
      select: Entry.title
    } as any),
    ['Alpha', 'Beta']
  )

  const bytes = db.exportBytes()
  test.is(await db.syncWith(source), sha)
  test.is(db.exportBytes(), bytes)

  const reopened = ContentEntryDB.open(config, bytes)
  test.is(reopened.sha, sha)
  test.is(await reopened.syncWith(source), sha)
  test.is(reopened.exportBytes(), bytes)

  const changed = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha Prime', 'Changed Body', 15),
    entry('article-beta', 'a2', 'beta', 'Beta', 'Plain Body', 20)
  ])
  const changedSha = await db.syncWith(changed)

  test.ok(changedSha !== sha)
  test.is(
    await db.resolve({
      id: 'article-alpha',
      select: Entry.title,
      get: true
    } as any),
    'Alpha Prime'
  )
})

async function createDb(entries: Array<FixtureEntry>) {
  const source = await createSource(entries)
  const index = new EntryIndex(config)
  await index.syncWith(source)
  const bytes = ContentEntryDB.fromIndex(config, index).exportBytes()
  return ContentEntryDB.open(config, bytes)
}

function entry(
  id: string,
  index: string,
  path: string,
  title: string,
  body: string,
  score: number,
  featured = score >= 20
): FixtureEntry {
  return {id, index, path, title, body, score, featured}
}

async function fileHashFor(input: FixtureEntry) {
  const record = recordFor(input)
  return hashBlob(new TextEncoder().encode(JSON.stringify(record, null, 2)))
}

async function createSource(entries: Array<FixtureEntry>) {
  const source = new MemorySource()
  const changes = await Promise.all(
    entries.map(async input => {
      const contents = new TextEncoder().encode(
        JSON.stringify(recordFor(input), null, 2)
      )
      return {
        op: 'add' as const,
        path: ConfigUtils.filePath(
          config,
          'main',
          'pages',
          null,
          `${input.path}.json`
        ),
        sha: await hashBlob(contents),
        contents
      }
    })
  )
  await source.applyChanges({
    fromSha: (await source.getTree()).sha,
    changes
  })
  return source
}

function recordFor(input: FixtureEntry) {
  return createRecord(
    {
      id: input.id,
      type: 'QueryArticle',
      index: input.index,
      root: 'pages',
      path: input.path,
      title: input.title,
      seeded: null,
      parentId: null,
      data: {
        title: input.title,
        path: input.path,
        body: input.body,
        score: input.score,
        featured: input.featured ?? false
      }
    },
    'published'
  )
}
