import {suite} from '@alinea/suite'
import {Client} from '#/core/Client.js'
import {createConfig} from '#/core/Config.js'
import type {Config} from '#/core/Config.js'
import type {UploadResponse} from '#/core/Connection.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {WriteableGraph as WriteableGraphBase} from '#/core/db/WriteableGraph.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {role} from '#/core/Role.js'
import {root} from '#/core/Root.js'
import {localUser} from '#/core/User.js'
import {workspace} from '#/core/Workspace.js'
import {createStore} from 'jotai/vanilla'
import {Dashboard, MissingEntryError, ReactiveNode} from './Dashboard.js'

const test = suite(import.meta)

interface Row {
  _id: string
  _type: string
}

function ids(rows: Array<Row>): Array<string> {
  return rows.map(row => row._id)
}

const config = {schema: {}, workspaces: {}} as Config

function waitForPolicy(
  dashboard: Dashboard,
  store: ReturnType<typeof createStore>
) {
  return new Promise<void>(resolve => {
    if (store.get(dashboard.policyReady)) {
      resolve()
      return
    }
    const unsubscribe = store.sub(dashboard.policyReady, () => {
      if (!store.get(dashboard.policyReady)) return
      unsubscribe()
      resolve()
    })
  })
}

class TestGraph extends WriteableGraphBase {
  constructor(public config: Config) {
    super()
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return Promise.resolve([] as AnyQueryResult<Query>)
  }

  mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return Promise.resolve({sha: 'test'})
  }

  prepareUpload(file: string): Promise<UploadResponse> {
    return Promise.resolve({
      entryId: 'upload',
      location: file,
      previewUrl: file,
      url: file
    })
  }
}

class SlowSyncGraph extends TestGraph {
  syncCalls = 0
  #resolveSync: (sha: string) => void = () => {}
  #syncPromise = new Promise<string>(resolve => {
    this.#resolveSync = resolve
  })

  sync(): Promise<string> {
    this.syncCalls += 1
    return this.#syncPromise
  }

  resolveSync(sha = 'synced'): void {
    this.#resolveSync(sha)
  }
}

function createDashboard(options: {local?: boolean; alineaDev?: boolean}) {
  const client = new Client({config, url: 'https://example.com/api'})
  client.authStatus = () => {
    throw new Error('Local dashboard should not check auth status')
  }
  return new Dashboard(
    {} as WriteableGraph,
    config,
    new EventTarget(),
    client,
    {},
    options
  )
}

test('Dashboard does not require auth in local dev', async () => {
  const store = createStore()
  const dashboard = createDashboard({local: true})

  test.equal(store.get(dashboard.authRequired), false)
  test.equal(store.get(dashboard.auth).status, 'authenticated')
  test.equal(await store.get(dashboard.user), localUser)
})

test('Dashboard role overrides update the active policy', async () => {
  const publicRoot = root('Public')
  const privateRoot = root('Private')
  const secondaryRoot = root('Secondary')
  const main = workspace('Main', {
    source: 'content/main',
    roots: {publicRoot, privateRoot}
  })
  const secondary = workspace('Secondary', {
    source: 'content/secondary',
    roots: {secondaryRoot}
  })
  const editor = role('Editor', {
    permissions(policy) {
      policy.set({root: publicRoot, allow: {read: true}})
    }
  })
  const config = createConfig({
    schema: {},
    workspaces: {main, secondary},
    roles: {editor}
  })
  const store = createStore()
  const dashboard = new Dashboard(
    new TestGraph(config),
    config,
    new EventTarget(),
    new Client({config, url: 'https://example.com/api'}),
    {},
    {local: true}
  )

  await store.set(dashboard.setUserRoles, ['editor'])
  await waitForPolicy(dashboard, store)
  const policy = store.get(dashboard.policy)

  test.ok(policy.canRead({workspace: 'main', root: 'publicRoot'}))
  test.not.ok(policy.canRead({workspace: 'main', root: 'privateRoot'}))
  test.not.ok(policy.canRead({workspace: 'secondary'}))
})

test('Dashboard policy and entry preloads do not wait for sync', async () => {
  const publicRoot = root('Public')
  const main = workspace('Main', {
    source: 'content/main',
    roots: {publicRoot}
  })
  const editor = role('Editor', {
    permissions(policy) {
      policy.set({root: publicRoot, allow: {read: true}})
    }
  })
  const config = createConfig({
    schema: {},
    workspaces: {main},
    roles: {editor}
  })
  const graph = new SlowSyncGraph(config)
  const store = createStore()
  const dashboard = new Dashboard(
    graph,
    config,
    new EventTarget(),
    new Client({config, url: 'https://example.com/api'}),
    {},
    {local: true}
  )

  await store.set(dashboard.setUserRoles, ['editor'])
  await waitForPolicy(dashboard, store)

  test.equal(graph.syncCalls, 0)
  test.ok(
    store.get(dashboard.policy).canRead({workspace: 'main', root: 'publicRoot'})
  )

  let missingEntryError = false
  try {
    await store.get(dashboard.entries('missing').preload)
  } catch (error) {
    missingEntryError = error instanceof MissingEntryError
  }
  test.equal(missingEntryError, true)
  test.equal(graph.syncCalls, 0)

  const sync = store.set(dashboard.sync)
  test.equal(graph.syncCalls, 1)
  graph.resolveSync()
  test.equal(await sync, 'synced')
  test.equal(store.get(dashboard.sha), 'synced')
})

test('Dashboard background sync is optional for unsyncable graphs', async () => {
  const dashboard = createDashboard({local: true})
  const store = createStore()

  await store.set(dashboard.sync)
})

test('DashboardExplorer filters queued uploads to its current folder', () => {
  const store = createStore()
  const dashboard = createDashboard({local: true})
  const explorer = dashboard.explore({
    workspace: 'main',
    root: 'media',
    parentId: 'folder'
  })

  store.set(dashboard.uploadProgress, {
    type: 'start',
    uploads: [{id: 'current-upload', file: new File(['a'], 'current.png')}],
    destination: {
      workspace: 'main',
      root: 'media',
      parentId: 'folder'
    }
  })
  store.set(dashboard.uploadProgress, {
    type: 'start',
    uploads: [{id: 'other-upload', file: new File(['b'], 'other.png')}],
    destination: {
      workspace: 'main',
      root: 'media',
      parentId: 'other-folder'
    }
  })

  test.equal(store.get(explorer.uploadsInCurrentFolder).length, 1)
  test.equal(store.get(explorer.uploadsInCurrentFolder)[0]?.id, 'current-upload')

  store.set(dashboard.uploadProgress, {
    type: 'finish',
    ids: ['current-upload']
  })

  test.equal(store.get(explorer.uploadsInCurrentFolder).length, 0)
})

test('ReactiveNode inserts array values at the requested index', () => {
  const store = createStore()
  const node = new ReactiveNode<Array<Row>>([
    {_id: 'a', _type: 'item'},
    {_id: 'b', _type: 'item'}
  ])

  store.set(node.insert, 0, {_id: 'top', _type: 'item'})
  store.set(node.insert, 2, {_id: 'middle', _type: 'item'})
  store.set(node.insert, 99, {_id: 'end', _type: 'item'})

  test.equal(ids(store.get(node.value)), ['top', 'a', 'middle', 'b', 'end'])
})
