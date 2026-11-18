import {MissingCredentialsError} from '#/backend/Auth.js'
import {composeBackend} from '#/backend/api/CreateBackend.js'
import type {GraftApi} from '#/backend/api/GraftApi.js'
import {graft} from '#/backend/api/graft.js'
import {createHandler} from '#/backend/Handler.js'
import {CONTENT_TREE_HEADER} from '#/core/BlobTransport.js'
import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {readTree} from '#/core/source/TreeObjects.js'
import {BrowserEntryStore} from '#/database/BrowserEntryStore.js'
import {DatabaseStateTable} from '#/database/DatabaseTables.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {commit, MemoryObjectStore, type Person} from '@alinea/graft'
import {readPack} from '@alinea/graft/git'
import {memorySnapshots} from '@alinea/sqlite-wasm/snapshots'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'

const Page = Config.document('Page', {
  fields: {body: Field.text('Body', {multiline: true})}
})
const cms = createCMS({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})
const config = cms.config
const context = {
  apiKey: 'test',
  handlerUrl: new URL('http://localhost/api'),
  isDev: false
}
const person: Person = {
  name: 'Ada',
  email: 'ada@example.com',
  timestamp: 0,
  timezone: '+0000'
}

async function seeded(): Promise<GraftApi> {
  const api = graft()(context, config)
  const build = new LocalDB(config)
  for (const id of ['home', 'about', 'contact'])
    await build.create({type: Page, id, set: {title: id, body: 'Hi'}})
  await api.seed(build)
  return api
}

/** Commit file contents below the content root. */
async function edit(api: GraftApi, files: Record<string, string | undefined>) {
  const head = await api.repo.refs.get(api.ref)
  await commit(api.repo, api.ref, {
    parents: [head!],
    changes: Object.entries(files).map(([path, contents]) =>
      contents === undefined
        ? {op: 'remove', path: `content/${path}`}
        : {
            op: 'put',
            path: `content/${path}`,
            contents: new TextEncoder().encode(contents)
          }
    ),
    author: person,
    committer: person,
    message: 'Edit\n'
  })
}

function page(id: string, title: string) {
  return JSON.stringify(
    {_id: id, _type: 'Page', _index: 'a0', _i18nId: id, title, body: 'Hi'},
    null,
    2
  )
}

test('an index syncs from the head of a store without recording a tree', async () => {
  const api = await seeded()
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  const index = new EntryDatabase(config, db)
  try {
    await index.syncWith(api)
    const head = await api.getHead()
    expect(await index.getRevision()).toBe(head.sha)
    const state = await db.select().from(DatabaseStateTable).get()
    expect(state?.tree ?? null).toBeNull()

    await edit(api, {'pages/about.json': page('about', 'About us')})
    const result = await index.syncWith(api)
    expect(result.changedEntryIds).toEqual(['about'])
    expect(
      await index.resolve({id: 'about', first: true, select: Entry.title})
    ).toBe('About us')
    const tree = await index.getTree()
    expect(tree.sha).toBe((await api.getHead()).sha)
    const sha = tree.getLeaf('pages/about.json').sha
    const [[, blob]] = await Array.fromAsync(index.getBlobs([sha]))
    expect(new TextDecoder().decode(blob)).toBe(page('about', 'About us'))
  } finally {
    await index.close()
  }
})

test('a pack since a content tree holds only what changed', async () => {
  const api = await seeded()
  const client = new MemoryObjectStore()
  const first = (await api.getPack(ReadonlyTree.EMPTY.sha))!
  await client.put(await readPack(first.pack!))
  const tree = await readTree(client, first.sha)
  expect(tree.sha).toBe(first.sha)

  expect(await api.getPack(first.sha)).toBe(undefined)
  await edit(api, {'pages/about.json': page('about', 'About us')})
  const second = (await api.getPack(first.sha))!
  const objects = await readPack(second.pack!, {bases: client})
  // The edited file and the two directories above it
  expect(objects.map(object => object.type).sort()).toEqual([
    'blob',
    'tree',
    'tree'
  ])
  expect(second.pack!.length).toBeLessThan(first.pack!.length)

  // A moved directory is not sent again
  await client.put(objects)
  await edit(api, {
    'pages/about/team.json': page('team', 'Team'),
    'pages/about/jobs.json': page('jobs', 'Jobs')
  })
  const third = (await api.getPack(second.sha))!
  await client.put(await readPack(third.pack!, {bases: client}))
  await edit(api, {
    'pages/about/team.json': undefined,
    'pages/about/jobs.json': undefined,
    'pages/company/team.json': page('team', 'Team'),
    'pages/company/jobs.json': page('jobs', 'Jobs')
  })
  const moved = (await api.getPack(third.sha))!
  const types = (await readPack(moved.pack!, {bases: client})).map(
    object => object.type
  )
  expect(types).toEqual(['tree', 'tree'])
})

test('the handler answers a sync with a pack, 304 when current', async () => {
  const api = await seeded()
  const handle = createHandler({
    cms,
    db: new LocalDB(config),
    remote: () =>
      composeBackend(api, {
        async verify() {
          throw new MissingCredentialsError('No user')
        }
      })
  })
  const sync = (have?: string) =>
    handle(
      new Request(
        `http://localhost/api?action=sync${have ? `&have=${have}` : ''}`,
        {headers: {authorization: 'Bearer test'}}
      ),
      context
    )
  // Without have it names the head
  const probe = await sync()
  expect(probe.status).toBe(204)
  const sha = probe.headers.get(CONTENT_TREE_HEADER)!
  expect(sha).toBe((await api.getHead()).sha)
  expect((await sync(ReadonlyTree.EMPTY.sha)).status).toBe(200)
  expect((await sync(sha)).status).toBe(304)
})

test('a browser store syncs with packs and keeps the objects', async () => {
  const api = await seeded()
  const objects = new MemoryObjectStore()
  let packs = 0
  let blobs = 0
  const remote: RemoteSource = {
    getTreeIfDifferent: sha => api.getTreeIfDifferent(sha),
    async *getBlobs(shas) {
      blobs += shas.length
      yield* api.getBlobs(shas)
    },
    getPack(have) {
      packs++
      return api.getPack(have)
    }
  }
  const storage = memorySnapshots()
  const options = {name: 'graft-sync', fingerprint: 'a', storage, objects}
  const store = await BrowserEntryStore.open(config, options)
  try {
    await store.syncWith(remote)
    expect(await store.count({type: Page})).toBe(3)
    await edit(api, {'pages/about.json': page('about', 'About us')})
    await store.syncWith(remote)
    expect(await store.first({id: 'about', select: Entry.title})).toBe(
      'About us'
    )
    expect(await store.syncWith(remote)).toBe((await api.getHead()).sha)
    // The first sync fetches the blobs and keeps them, the next get packs
    expect([packs, blobs]).toEqual([3, 3])
  } finally {
    await store.close()
  }

  // Another config derives the entries again from the objects
  const other = await BrowserEntryStore.open(config, {
    ...options,
    fingerprint: 'b'
  })
  try {
    expect(await other.first({id: 'about', select: Entry.title})).toBe(
      'About us'
    )
  } finally {
    await other.close()
  }
})
