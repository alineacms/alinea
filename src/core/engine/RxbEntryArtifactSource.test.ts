import {suite} from '@alinea/suite'
import {Config, Field} from 'alinea'
import {Config as ConfigUtils, createConfig} from '../Config.js'
import {Entry} from '../Entry.js'
import type {EntryStatus} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import type {SyncApi} from '../Connection.js'
import type {Mutation} from '../db/Mutation.js'
import {hashBlob} from '../source/GitUtils.js'
import {MemorySource} from '../source/MemorySource.js'
import {
  createRxbEntryArtifact,
  encodeRxbEntryArtifact,
  openRxbEntryEngine,
  RxbEntryDB
} from './index.js'
import {
  applyRxbEntryMutations,
  syncRxbEntryArtifact
} from './RxbEntryArtifactSource.js'
import {EntryIndex} from './EntryIndex.js'

const test = suite(import.meta)

const QueryArticle = Config.document('QueryArticle', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
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
  score: number
  featured?: boolean
  status?: EntryStatus
}

test('RXB artifact can apply an array of optimistic mutations and re-encode', async () => {
  const source = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10),
    entry('article-beta', 'a2', 'beta', 'Beta', 20)
  ])
  const artifact = await createArtifact(source)

  const mutations: Array<Mutation> = [
    {
      op: 'update',
      id: 'article-alpha',
      locale: null,
      status: 'published',
      set: {title: 'Alpha Prime', score: 15}
    },
    {
      op: 'create',
      id: 'article-gamma',
      locale: null,
      type: 'QueryArticle',
      workspace: 'main',
      root: 'pages',
      data: {
        title: 'Gamma',
        path: 'gamma',
        score: 30,
        featured: true
      }
    }
  ]

  const next = await applyRxbEntryMutations(config, artifact, mutations)
  const engine = openRxbEntryEngine(encodeRxbEntryArtifact(next))

  test.equal(
    await engine.query({
      query: {
        type: 'QueryArticle',
        orderBy: {asc: Entry.title},
        select: {
          id: Entry.id,
          title: Entry.title
        }
      } as any
    }),
    [
      {id: 'article-alpha', title: 'Alpha Prime'},
      {id: 'article-beta', title: 'Beta'},
      {id: 'article-gamma', title: 'Gamma'}
    ]
  )
  test.is(next.meta.contentHash, next.meta.graphSha)
})

test('RXB entry DB opens bytes, resolves, applies local mutations, exports, and rolls back', async () => {
  const source = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10),
    entry('article-beta', 'a2', 'beta', 'Beta', 20)
  ])
  const artifact = await createArtifact(source)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))

  test.equal(
    await db.resolve({
      type: 'QueryArticle',
      orderBy: {asc: Entry.title},
      select: Entry.id
    } as any),
    ['article-alpha', 'article-beta']
  )

  const {rollback} = await db.applyLocal([
    {
      op: 'update',
      id: 'article-alpha',
      locale: null,
      status: 'published',
      set: {title: 'Alpha Prime'}
    }
  ])

  test.equal(
    await db.resolve({
      id: 'article-alpha',
      select: Entry.title,
      get: true
    } as any),
    'Alpha Prime'
  )

  const reopened = RxbEntryDB.open(config, db.exportBytes())
  test.equal(
    await reopened.resolve({
      id: 'article-alpha',
      select: Entry.title,
      get: true
    } as any),
    'Alpha Prime'
  )

  db.rollback(rollback)
  test.equal(
    await db.resolve({
      id: 'article-alpha',
      select: Entry.title,
      get: true
    } as any),
    'Alpha'
  )
})

test('RXB artifact can sync from a server source by fetching only changed blobs', async () => {
  const local = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10),
    entry('article-beta', 'a2', 'beta', 'Beta', 20)
  ])
  const remote = await createSource([
    entry('article-beta', 'a2', 'beta', 'Beta Remote', 25),
    entry('article-gamma', 'a3', 'gamma', 'Gamma', 30)
  ])
  const artifact = await createArtifact(local)
  const localTree = await local.getTree()
  const remoteTree = await remote.getTree()
  const expectedBlobRequests = localTree
    .diff(remoteTree)
    .changes.filter(change => change.op === 'add')
    .map(change => change.sha)
    .sort()
  const requestedBlobs = Array<string>()
  const trackedRemote: SyncApi = {
    getTreeIfDifferent: sha => remote.getTreeIfDifferent(sha),
    async *getBlobs(shas) {
      requestedBlobs.push(...shas)
      yield* remote.getBlobs(shas)
    }
  }

  const synced = await syncRxbEntryArtifact(config, artifact, trackedRemote)
  const engine = openRxbEntryEngine(encodeRxbEntryArtifact(synced))

  test.equal(requestedBlobs.sort(), expectedBlobRequests)
  test.is(synced.meta.graphSha, remoteTree.sha)
  test.equal(
    await engine.query({
      query: {
        type: 'QueryArticle',
        orderBy: {asc: Entry.title},
        select: {
          id: Entry.id,
          title: Entry.title
        }
      } as any
    }),
    [
      {id: 'article-beta', title: 'Beta Remote'},
      {id: 'article-gamma', title: 'Gamma'}
    ]
  )
})

test('RXB entry DB syncs bytes from a remote source', async () => {
  const local = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10),
    entry('article-beta', 'a2', 'beta', 'Beta', 20)
  ])
  const remote = await createSource([
    entry('article-beta', 'a2', 'beta', 'Beta Remote', 25),
    entry('article-gamma', 'a3', 'gamma', 'Gamma', 30)
  ])
  const artifact = await createArtifact(local)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))

  await db.syncWith(remote)

  test.equal(
    await db.resolve({
      type: 'QueryArticle',
      orderBy: {asc: Entry.title},
      select: Entry.id
    } as any),
    ['article-beta', 'article-gamma']
  )

  const reopened = RxbEntryDB.open(config, db.bytes)
  test.equal(
    await reopened.resolve({
      id: 'article-beta',
      select: Entry.title,
      get: true
    } as any),
    'Beta Remote'
  )
})

function entry(
  id: string,
  index: string,
  path: string,
  title: string,
  score: number
): FixtureEntry {
  return {id, index, path, title, score, featured: score >= 30}
}

async function createArtifact(source: MemorySource) {
  const index = new EntryIndex(config)
  await index.syncWith(source)
  return createRxbEntryArtifact(index.snapshot, {
    configHash: 'config-hash',
    contentHash: index.sha
  })
}

async function createSource(entries: Array<FixtureEntry>) {
  const source = new MemorySource()
  const changes = await Promise.all(
    entries.map(async input => {
      const status = input.status ?? 'published'
      const record = createRecord(
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
            score: input.score,
            featured: input.featured ?? false
          }
        },
        status
      )
      const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
      return {
        op: 'add' as const,
        path: ConfigUtils.filePath(
          config,
          'main',
          'pages',
          null,
          `${input.path}${status === 'published' ? '' : `.${status}`}.json`
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
