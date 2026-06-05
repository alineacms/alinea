import {suite} from '@alinea/suite'
import {Client} from '#/core/Client.js'
import {createConfig} from '#/core/Config.js'
import type {Config} from '#/core/Config.js'
import type {UploadResponse} from '#/core/Connection.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {WriteableGraph as WriteableGraphBase} from '#/core/db/WriteableGraph.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {role} from '#/core/Role.js'
import {root} from '#/core/Root.js'
import {type as createType} from '#/core/Type.js'
import {localUser} from '#/core/User.js'
import {workspace} from '#/core/Workspace.js'
import {atom} from 'jotai'
import {createStore} from 'jotai/vanilla'
import {
  Dashboard,
  DashboardEntryData,
  MissingEntryError,
  ReactiveNode
} from './Dashboard.js'

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

class ReferenceGraph extends TestGraph {
  referencesTo(query: EntryReferenceQuery): Promise<EntryReferenceResult> {
    return Promise.resolve({
      total: 1,
      scan: {scanned: 2, total: 2, complete: true},
      references: [
        {
          targetId: query.targetId,
          sourceId: 'source',
          sourceFilePath: 'pages/source.json',
          sourceType: 'Page',
          sourceLocale: null,
          sourceStatus: 'published',
          sourceActive: true,
          sourceMain: true,
          fieldPath: 'related',
          fieldLabel: 'Related',
          linkId: 'related-link',
          linkType: 'entry'
        }
      ]
    })
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return Promise.resolve([
      {
        id: 'source',
        title: 'Source',
        type: 'Page',
        workspace: 'main',
        root: 'pages',
        locale: null,
        status: 'published',
        path: 'source',
        url: '/source'
      }
    ] as AnyQueryResult<Query>)
  }
}

class MediaGraph extends TestGraph {
  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    if ('parentId' in query) return Promise.resolve([] as AnyQueryResult<Query>)
    const entries = [
      {
        id: 'media-folder',
        type: 'MediaLibrary',
        parentId: null,
        workspace: 'main',
        root: 'media',
        locale: null,
        status: 'published',
        main: true,
        path: 'media-folder',
        title: 'Media folder',
        url: '/media-folder',
        filePath: 'media/media-folder.json',
        seeded: null,
        data: {title: 'Media folder', path: 'media-folder'}
      },
      {
        id: 'media-file',
        type: 'MediaFile',
        parentId: 'media-folder',
        workspace: 'main',
        root: 'media',
        locale: null,
        status: 'published',
        main: true,
        path: 'media-folder/media-file.png',
        title: 'Media file',
        url: '/media-folder/media-file.png',
        filePath: 'media/media-folder/media-file.png.json',
        seeded: null,
        data: {
          title: 'Media file',
          path: 'media-file.png',
          location: '/media-file.png'
        }
      }
    ] as const
    if (!('groupBy' in query)) {
      return Promise.resolve(entries as AnyQueryResult<Query>)
    }
    return Promise.resolve([
      {
        id: 'media-folder',
        type: 'MediaLibrary',
        parentId: null,
        workspace: 'main',
        root: 'media',
        parents: [],
        entries: [entries[0]]
      },
      {
        id: 'media-file',
        type: 'MediaFile',
        parentId: 'media-folder',
        workspace: 'main',
        root: 'media',
        parents: [
          {
            id: 'media-folder',
            path: 'media-folder',
            type: 'MediaLibrary',
            status: 'published',
            main: true
          }
        ],
        entries: [entries[1]]
      }
    ] as AnyQueryResult<Query>)
  }
}

function hasInFilter(value: unknown): value is {in: Array<string>} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'in' in value &&
    Array.isArray((value as {in?: unknown}).in)
  )
}

class HierarchyGraph extends TestGraph {
  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const entries = [
      {
        id: 'blog',
        type: 'Page',
        parentId: null,
        workspace: 'main',
        root: 'pages',
        locale: null,
        status: 'published',
        main: true,
        path: 'blog',
        title: 'Blog',
        url: '/blog',
        filePath: 'pages/blog.json',
        seeded: null,
        data: {title: 'Blog', path: 'blog'}
      },
      {
        id: 'post',
        type: 'Page',
        parentId: 'blog',
        workspace: 'main',
        root: 'pages',
        locale: null,
        status: 'published',
        main: true,
        path: 'blog/post',
        title: 'Post',
        url: '/blog/post',
        filePath: 'pages/blog/post.json',
        seeded: null,
        data: {title: 'Post', path: 'post'}
      }
    ] as const
    if ('parentId' in query && hasInFilter(query.parentId)) {
      return Promise.resolve(['blog'] as AnyQueryResult<Query>)
    }
    const idFilter = 'id' in query ? query.id : undefined
    if (hasInFilter(idFilter)) {
      return Promise.resolve(
        entries
          .filter(entry => idFilter.in.includes(entry.id))
          .map(entry => ({
            ...entry,
            parents:
              entry.id === 'post'
                ? [
                    {
                      id: 'blog',
                      path: 'blog',
                      type: 'Page',
                      status: 'published',
                      main: true
                    }
                  ]
                : [],
            entries: [entry]
          })) as AnyQueryResult<Query>
      )
    }
    if ('parentId' in query) {
      return Promise.resolve(
        entries.filter(entry => entry.parentId === query.parentId) as
          AnyQueryResult<Query>
      )
    }
    return Promise.resolve(entries as AnyQueryResult<Query>)
  }
}

class TestEvents extends EventTarget {
  listeners = new Set<(event: Event) => void>()

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type !== IndexEvent.type || typeof listener !== 'function') return
    this.listeners.add(listener)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ) {
    if (type !== IndexEvent.type || typeof listener !== 'function') return
    this.listeners.delete(listener)
  }

  emit(event: IndexEvent) {
    for (const listener of this.listeners) listener(event)
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

test('Dashboard tracks entry reference scan progress', () => {
  const store = createStore()
  const events = new TestEvents()
  const dashboard = new Dashboard(
    new TestGraph(config),
    config,
    events,
    new Client({config, url: 'https://example.com/api'}),
    {},
    {local: true}
  )
  const unsubscribe = store.sub(dashboard.entryReferenceScan, () => {})

  events.emit(
    new IndexEvent({
      op: 'references',
      scanned: 4,
      total: 10,
      complete: false
    })
  )

  test.equal(store.get(dashboard.entryReferenceScan), {
    scanned: 4,
    total: 10,
    complete: false
  })
  unsubscribe()
})

test('DashboardEntryData exposes incoming references', async () => {
  const Page = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content/main',
        roots: {pages: root('Pages')}
      })
    },
    roles: {
      admin: role('Admin', {
        permissions(policy) {
          policy.allowAll()
        }
      })
    }
  })
  const store = createStore()
  const dashboard = new Dashboard(
    new ReferenceGraph(Page),
    Page,
    new EventTarget(),
    new Client({config: Page, url: 'https://example.com/api'}),
    {},
    {local: true}
  )
  const entry = new DashboardEntryData(
    {dashboard, id: 'target'} as never,
    atom({
      id: 'target',
      type: 'Page',
      parentId: null,
      workspace: 'main',
      root: 'pages',
      hasChildren: false,
      parents: [],
      entries: []
    })
  )

  await waitForPolicy(dashboard, store)
  const references = await store.get(entry.incomingReferences)

  test.is(references.total, 1)
  test.equal(references.scan, {scanned: 2, total: 2, complete: true})
  test.equal(references.references[0]?.source.title, 'Source')
  test.equal(references.references[0]?.reference.fieldPath, 'related')
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

test('DashboardEntry ready state resolves missing entries', async () => {
  const store = createStore()
  const dashboard = new Dashboard(
    new TestGraph(config),
    config,
    new EventTarget(),
    new Client({config, url: 'https://example.com/api'}),
    {},
    {local: true}
  )
  const ready = await store.get(dashboard.entries('missing').readyState)

  test.equal(ready.pending, false)
  test.equal(ready.data, undefined)
  test.ok(ready.error instanceof MissingEntryError)
})

test('DashboardRoot explorer opens media libraries but not focused files', async () => {
  const originalWindow = globalThis.window
  const testWindow = {
    location: {
      hash: '',
      href: 'https://example.com/',
      pathname: '/',
      search: ''
    },
    history: {
      pushState(_state: unknown, _title: string, url?: string | URL | null) {
        if (!url) return
        const next = new URL(url, testWindow.location.href)
        testWindow.location.hash = next.hash
        testWindow.location.href = next.href
        testWindow.location.pathname = next.pathname
        testWindow.location.search = next.search
      },
      replaceState(_state: unknown, _title: string, url?: string | URL | null) {
        if (!url) return
        const next = new URL(url, testWindow.location.href)
        testWindow.location.hash = next.hash
        testWindow.location.href = next.href
        testWindow.location.pathname = next.pathname
        testWindow.location.search = next.search
      },
      state: null
    },
    addEventListener() {},
    removeEventListener() {}
  } as unknown as Window & typeof globalThis
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: testWindow
  })

  try {
    const createDashboard = async (hash = '') => {
      testWindow.location.hash = hash
      testWindow.location.href = `https://example.com/${hash}`
      const media = root('Media')
      const main = workspace('Main', {
        source: 'content/main',
        roots: {media}
      })
      const config = createConfig({
        schema: {},
        workspaces: {main},
        roles: {
          admin: role('Admin', {
            permissions(policy) {
              policy.allowAll()
            }
          })
        }
      })
      const store = createStore()
      const dashboard = new Dashboard(
        new MediaGraph(config),
        config,
        new EventTarget(),
        new Client({config, url: 'https://example.com/api'}),
        {},
        {local: true}
      )
      await store.set(dashboard.setUserRoles, ['admin'])
      await waitForPolicy(dashboard, store)
      return {
        dashboard,
        mediaRoot: dashboard.workspace('main').root('media'),
        store
      }
    }
    const waitForParentId = async (
      model: Awaited<ReturnType<typeof createDashboard>>,
      parentId: string | undefined
    ) => {
      const location = model.mediaRoot.explorer.location
      const isMatch = () => storeParentId() === parentId
      const storeParentId = () => model.store.get(location).parentId
      if (isMatch()) return
      await new Promise<void>(resolve => {
        let unsubscribe = () => {}
        const check = () => {
          if (!isMatch()) return
          unsubscribe()
          resolve()
        }
        unsubscribe = model.store.sub(location, check)
        check()
      })
    }

    const file = await createDashboard('#/entry/main/media/media-file')
    const unsubscribeFileLocation = file.store.sub(
      file.mediaRoot.explorer.location,
      () => {}
    )
    await file.store.get(file.dashboard.entries('media-file').readyState)
    await new Promise(resolve => setTimeout(resolve, 0))
    unsubscribeFileLocation()
    await waitForParentId(file, undefined)

    test.equal(file.store.get(file.mediaRoot.explorer.location), {
      workspace: 'main',
      root: 'media',
      parentId: undefined
    })

    const folder = await createDashboard('#/entry/main/media/media-folder')
    const folderEntry = folder.dashboard.entries('media-folder')
    const unsubscribe = folder.store.sub(folderEntry.data, () => {})
    await waitForParentId(folder, 'media-folder')

    test.equal(folder.store.get(folder.mediaRoot.explorer.location), {
      workspace: 'main',
      root: 'media',
      parentId: 'media-folder'
    })

    folder.store.set(folder.mediaRoot.explorer.location, {
      workspace: 'main',
      root: 'media'
    })
    await waitForParentId(folder, undefined)
    await folder.store.set(folder.mediaRoot.explorer.onAction, folderEntry)
    await waitForParentId(folder, 'media-folder')
    unsubscribe()

    test.equal(folder.store.get(folder.mediaRoot.explorer.location), {
      workspace: 'main',
      root: 'media',
      parentId: 'media-folder'
    })

    const sidebar = await createDashboard()
    await sidebar.store.set(sidebar.dashboard.route, {
      workspace: 'main',
      root: 'media',
      entry: 'media-folder'
    })
    await waitForParentId(sidebar, 'media-folder')

    test.equal(sidebar.store.get(sidebar.mediaRoot.explorer.location), {
      workspace: 'main',
      root: 'media',
      parentId: 'media-folder'
    })
  } finally {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window')
    } else {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow
      })
    }
  }
})

test('DashboardRoot explorer opens child overviews from the root listing', async () => {
  const originalWindow = globalThis.window
  const testWindow = {
    location: {
      hash: '',
      href: 'https://example.com/',
      pathname: '/',
      search: ''
    },
    history: {
      pushState(_state: unknown, _title: string, url?: string | URL | null) {
        if (!url) return
        const next = new URL(url, testWindow.location.href)
        testWindow.location.hash = next.hash
        testWindow.location.href = next.href
        testWindow.location.pathname = next.pathname
        testWindow.location.search = next.search
      },
      replaceState(_state: unknown, _title: string, url?: string | URL | null) {
        if (!url) return
        const next = new URL(url, testWindow.location.href)
        testWindow.location.hash = next.hash
        testWindow.location.href = next.href
        testWindow.location.pathname = next.pathname
        testWindow.location.search = next.search
      },
      state: null
    },
    addEventListener() {},
    removeEventListener() {}
  } as unknown as Window & typeof globalThis
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: testWindow
  })

  try {
    const Page = createType('Page', {fields: {}, defaultView: 'edit'})
    const pages = root('Pages')
    const main = workspace('Main', {
      source: 'content/main',
      roots: {pages}
    })
    const config = createConfig({
      schema: {Page},
      workspaces: {main},
      roles: {
        admin: role('Admin', {
          permissions(policy) {
            policy.allowAll()
          }
        })
      }
    })
    const store = createStore()
    const dashboard = new Dashboard(
      new HierarchyGraph(config),
      config,
      new EventTarget(),
      new Client({config, url: 'https://example.com/api'}),
      {},
      {local: true}
    )
    await store.set(dashboard.setUserRoles, ['admin'])
    await waitForPolicy(dashboard, store)

    const rootModel = dashboard.workspace('main').root('pages')
    const blog = dashboard.entries('blog')
    const ready = await store.get(blog.readyState)
    const data = ready.data
    if (!data) throw new Error('Blog entry should be loaded')
    test.equal(store.get(data.hasChildren), true)
    test.equal(store.get(data.defaultView), 'overview')
    await store.set(rootModel.explorer.onAction, blog)
    if (store.get(rootModel.explorer.location).parentId !== 'blog') {
      await new Promise<void>(resolve => {
        let unsubscribe = () => {}
        const check = () => {
          if (store.get(rootModel.explorer.location).parentId !== 'blog')
            return
          unsubscribe()
          resolve()
        }
        unsubscribe = store.sub(rootModel.explorer.location, check)
        check()
      })
    }

    test.equal(store.get(rootModel.explorer.location), {
      workspace: 'main',
      root: 'pages',
      parentId: 'blog'
    })

    await store.set(dashboard.route, {
      workspace: 'main',
      root: 'pages',
      entry: 'post'
    })

    test.equal(store.get(rootModel.explorer.location), {
      workspace: 'main',
      root: 'pages',
      parentId: 'blog'
    })
  } finally {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window')
    } else {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow
      })
    }
  }
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
  test.equal(
    store.get(explorer.uploadsInCurrentFolder)[0]?.id,
    'current-upload'
  )

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
