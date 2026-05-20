import {suite} from '@alinea/suite'
import {Config, Edit, Field} from 'alinea'
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
  RxbLocalDB,
  RxbEntryDB
} from './index.js'
import {EntryIndex} from '../db/EntryIndex.js'
import {exportSource} from '../source/SourceExport.js'

const test = suite(import.meta)

const QueryArticle = Config.document('QueryArticle', {
  contains: ['QueryArticle'],
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    score: Field.number('Score'),
    featured: Field.check('Featured'),
    links: Field.entry.multiple('Links')
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
  links?: Array<unknown>
}

test('RXB entry DB can apply an array of optimistic mutations and re-encode', async () => {
  const source = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10),
    entry('article-beta', 'a2', 'beta', 'Beta', 20)
  ])
  const artifact = await createArtifact(source)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))

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

  await db.mutations(mutations)

  test.equal(
    await db.resolve({
      type: 'QueryArticle',
      orderBy: {asc: Entry.title},
      select: {
        id: Entry.id,
        title: Entry.title
      }
    } as any),
    [
      {id: 'article-alpha', title: 'Alpha Prime'},
      {id: 'article-beta', title: 'Beta'},
      {id: 'article-gamma', title: 'Gamma'}
    ]
  )
  test.is(db.artifact.meta.contentHash, db.artifact.meta.graphSha)
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

  const {rollback} = await db.mutations([
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

  const compressed = await db.exportCompressedBytes()
  const reopenedCompressed = await RxbEntryDB.openCompressed(config, compressed)
  test.equal(
    await reopenedCompressed.resolve({
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

test('RXB entry DB can sync from a server source by fetching only changed blobs', async () => {
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
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))

  await db.syncWith(trackedRemote)

  test.equal(requestedBlobs.sort(), expectedBlobRequests)
  test.is(db.graphSha, remoteTree.sha)
  test.equal(
    await db.resolve({
      type: 'QueryArticle',
      orderBy: {asc: Entry.title},
      select: {
        id: Entry.id,
        title: Entry.title
      }
    } as any),
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

test('RXB entry DB post-processes selected entry links', async () => {
  const source = await createSource([
    entry('published-target', 'a1', 'published-target', 'Published target', 10),
    {
      ...entry('draft-target', 'a2', 'draft-target', 'Draft target', 20),
      status: 'draft'
    },
    {
      ...entry('source-entry', 'a3', 'source-entry', 'Source', 30),
      links: Edit.links(QueryArticle.links)
        .addEntry('published-target')
        .addEntry('draft-target')
        .value()
    }
  ])
  const artifact = await createArtifact(source)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))

  test.equal(
    await db.resolve({
      id: {in: ['published-target', 'draft-target']},
      select: {
        id: Entry.id,
        status: Entry.status
      }
    } as any),
    [{id: 'published-target', status: 'published'}]
  )

  const published = (await db.resolve({
    id: 'source-entry',
    get: true,
    select: QueryArticle.links
  } as any)) as Array<any>
  test.equal(
    published.map((link: any) => link.entryId),
    ['published-target']
  )
  test.is((published[0] as any).title, 'Published target')

  const all = (await db.resolve({
    id: 'source-entry',
    status: 'all',
    get: true,
    select: QueryArticle.links
  } as any)) as Array<any>
  test.equal(
    all.map((link: any) => link.entryId).sort(),
    ['draft-target', 'published-target']
  )
})

test('RXB entry DB handles publish, archive, remove, and rollback', async () => {
  const source = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10)
  ])
  const artifact = await createArtifact(source)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))

  const unpublish = await db.mutations([
    {op: 'unpublish', id: 'article-alpha', locale: null}
  ])
  test.equal(
    await db.resolve({
      id: 'article-alpha',
      status: 'all',
      select: Entry.status
    } as any),
    ['draft']
  )

  db.rollback(unpublish.rollback)
  test.equal(
    await db.resolve({
      id: 'article-alpha',
      status: 'all',
      select: Entry.status
    } as any),
    ['published']
  )

  await db.mutations([{op: 'unpublish', id: 'article-alpha', locale: null}])
  await db.mutations([
    {op: 'publish', id: 'article-alpha', locale: null, status: 'draft'}
  ])
  await db.mutations([{op: 'archive', id: 'article-alpha', locale: null}])
  test.equal(
    await db.resolve({
      id: 'article-alpha',
      status: 'all',
      select: Entry.status
    } as any),
    ['archived']
  )

  await db.mutations([
    {op: 'remove', id: 'article-alpha', locale: null, status: 'archived'}
  ])
  test.equal(
    await db.resolve({
      id: 'article-alpha',
      status: 'all',
      select: Entry.id
    } as any),
    []
  )
})

test('RXB entry DB handles move mutations', async () => {
  const source = await createSource([
    entry('parent-a', 'a1', 'parent-a', 'Parent A', 10),
    entry('parent-b', 'a2', 'parent-b', 'Parent B', 20),
    entry('child', 'a3', 'parent-a/child', 'Child', 30)
  ])
  const artifact = await createArtifact(source)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))

  await db.mutations([
    {op: 'move', id: 'child', toParent: 'parent-b', after: null}
  ])

  test.equal(
    await db.resolve({
      id: 'child',
      select: {
        id: Entry.id,
        parentId: Entry.parentId,
        filePath: Entry.filePath
      },
      get: true
    } as any),
    {
      id: 'child',
      parentId: 'parent-b',
      filePath: 'pages/parent-b/child.json'
    }
  )
})

test('RXB entry DB leaves state unchanged when mutation validation fails', async () => {
  const source = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10)
  ])
  const artifact = await createArtifact(source)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))
  const sha = db.sha

  await test.throws(async () => {
    await db.mutations([
      {
        op: 'update',
        id: 'missing-entry',
        locale: null,
        status: 'published',
        set: {title: 'Should not apply'}
      }
    ])
  }, 'Entry not found')

  test.is(db.sha, sha)
  test.is(
    await db.resolve({
      id: 'article-alpha',
      select: Entry.title,
      get: true
    } as any),
    'Alpha'
  )
})

test('RXB entry DB sync rebases optimistic local state onto server source', async () => {
  const local = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10)
  ])
  const remote = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Server Alpha', 20),
    entry('article-beta', 'a2', 'beta', 'Server Beta', 30)
  ])
  const artifact = await createArtifact(local)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))

  await db.mutations([
    {
      op: 'update',
      id: 'article-alpha',
      locale: null,
      status: 'published',
      set: {title: 'Optimistic Alpha'}
    }
  ])
  await db.syncWith(remote)

  test.equal(
    await db.resolve({
      type: 'QueryArticle',
      orderBy: {asc: Entry.title},
      select: {
        id: Entry.id,
        title: Entry.title
      }
    } as any),
    [
      {id: 'article-alpha', title: 'Server Alpha'},
      {id: 'article-beta', title: 'Server Beta'}
    ]
  )
})

test('RXB entry DB leaves state unchanged when sync misses remote blobs', async () => {
  const local = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10)
  ])
  const remote = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Server Alpha', 20)
  ])
  const artifact = await createArtifact(local)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))
  const sha = db.sha
  const brokenRemote: SyncApi = {
    getTreeIfDifferent: remote.getTreeIfDifferent.bind(remote),
    async *getBlobs() {}
  }

  await test.throws(async () => {
    await db.syncWith(brokenRemote)
  }, 'Missing remote blobs')

  test.is(db.sha, sha)
  test.is(
    await db.resolve({
      id: 'article-alpha',
      select: Entry.title,
      get: true
    } as any),
    'Alpha'
  )
})

test('RXB entry DB sync is a no-op when the remote tree is unchanged', async () => {
  const source = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10)
  ])
  const artifact = await createArtifact(source)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))
  const bytes = db.exportBytes()
  const requestedBlobs = Array<string>()
  const trackedRemote: SyncApi = {
    getTreeIfDifferent: sha => source.getTreeIfDifferent(sha),
    async *getBlobs(shas) {
      requestedBlobs.push(...shas)
      yield* source.getBlobs(shas)
    }
  }

  const sha = await db.syncWith(trackedRemote)

  test.is(sha, artifact.meta.graphSha)
  test.is(db.exportBytes(), bytes)
  test.equal(requestedBlobs, [])
})

test('RXB entry DB compressed export stays smaller than source export', async () => {
  const source = await createSource(
    Array.from({length: 1000}, (_, i) =>
      entry(
        `article-${i}`,
        i.toString().padStart(8, '0'),
        `article-${i}`,
        `Article ${i}`,
        i
      )
    )
  )
  const artifact = await createArtifact(source)
  const db = RxbEntryDB.open(config, encodeRxbEntryArtifact(artifact))
  const rxbBytes = Buffer.byteLength(await db.exportCompressedBytes())
  const sourceBytes = Buffer.byteLength(
    JSON.stringify(await exportSource(source))
  )

  test.ok(rxbBytes < sourceBytes)
})

test('RXB local DB can open from a source, resolve, mutate, sync, and export bytes', async () => {
  const local = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Alpha', 10)
  ])
  const remote = await createSource([
    entry('article-alpha', 'a1', 'alpha', 'Remote Alpha', 15),
    entry('article-beta', 'a2', 'beta', 'Beta', 20)
  ])
  const db = await RxbLocalDB.fromSource(config, local)

  test.is(
    await db.resolve({
      id: 'article-alpha',
      select: Entry.title,
      get: true
    } as any),
    'Alpha'
  )

  await db.mutate([
    {
      op: 'update',
      id: 'article-alpha',
      locale: null,
      status: 'published',
      set: {title: 'Optimistic Alpha'}
    }
  ])
  test.is(
    await db.resolve({
      id: 'article-alpha',
      select: Entry.title,
      get: true
    } as any),
    'Optimistic Alpha'
  )

  await db.syncWith(remote)
  test.equal(
    await db.resolve({
      type: 'QueryArticle',
      orderBy: {asc: Entry.title},
      select: Entry.title
    } as any),
    ['Beta', 'Remote Alpha']
  )
  test.ok(db.exportBytes().byteLength > 0)

  const reopened = RxbLocalDB.open(config, db.bytes)
  test.is(
    await reopened.resolve({
      id: 'article-beta',
      select: Entry.title,
      get: true
    } as any),
    'Beta'
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
  return createRxbEntryArtifact(config, index, {
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
            featured: input.featured ?? false,
            links: input.links ?? []
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
