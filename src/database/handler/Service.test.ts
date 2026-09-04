import {expect, test} from 'bun:test'
import {Policy, role} from '#/core/Role.js'
import {ReplicaService} from './Service.js'
import type {RuntimeDatabaseIndex} from '../runtime/Model.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {base64} from '#/core/util/Encoding.js'
import {cms} from '#test/cms.js'
import {FSSource} from '#/core/source/FSSource.js'
import {runtimeSourcePathResolver} from '../runtime/Model.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {
  exportRuntimeDatabase,
  exportRuntimeSourceChanges
} from '../runtime/Exporter.js'
import {replicaRangeSource} from '../replica/InlineBundles.js'
import {MemoryRangeSource} from '../replica/Bundle.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {DemoRecipe} from '#test/schema/DemoRecipe.js'

test('projects a runtime replica directly from the generated index', () => {
  const runtime: RuntimeDatabaseIndex = {
    revision: 'tree-1',
    bundleId: 'release-1',
    bundleUrl: '/admin/release-1/payload.bundle',
    entries: [
      {
        kind: 'entry',
        id: 'entry:pages/example.json',
        queryable: true,
        entryId: 'example',
        versionStatus: 'published',
        status: 'published',
        active: true,
        main: true,
        type: 'Page',
        title: 'Example',
        seeded: null,
        workspace: 'main',
        root: 'pages',
        locale: null,
        level: 0,
        index: 'a0',
        parentId: null,
        parents: [],
        path: 'example',
        url: '/example',
        frames: {
          decodeKey: 'secret',
          data: {
            offset: 0,
            length: 1,
            nonce: '',
            compression: 'none'
          }
        }
      }
    ]
  }
  const service = new ReplicaService({
    config: cms.config,
    configId: 'config-1',
    configUrl: '/admin/config/config-1/client-config.js',
    cacheKey: 'runtime:release-1',
    runtime,
    store: new RuntimeEntryStore({
      index: runtime,
      source: () => ({
        async read() {
          return new Uint8Array()
        }
      })
    })
  })
  const session = {
    user: {id: 'user-1', roles: ['admin']},
    policy: Policy.ALLOW_ALL,
    policyFingerprint: 'admin'
  }

  const state = service.state(session)

  expect(state?.runtime?.source).toBeUndefined()
  expect(state?.runtime?.entries[0].frames?.decodeKey).toBe('secret')
  expect(service.bootstrap(session)).toMatchObject({
    viewId: 'admin',
    cacheKey: '["runtime:release-1","user-1","admin"]'
  })
  expect(
    service.state(session, {revision: 'tree-1', viewId: 'another-view'})
  ).toBeDefined()
  expect(
    service.state(session, {revision: 'tree-1', viewId: 'admin'})
  ).toBeUndefined()
})

test('retries policy evaluation when the runtime changes concurrently', async () => {
  let release!: () => void
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  let evaluations = 0
  const editor = role('Editor', {
    async permissions(policy) {
      evaluations++
      if (evaluations === 1) await gate
      policy.set({id: `evaluation-${evaluations}`, allow: {read: true}})
    }
  })
  const config = {...cms.config, roles: {editor}}
  const runtime: RuntimeDatabaseIndex = {
    revision: 'tree-1',
    bundleId: 'release-1',
    bundleUrl: '/payload.bundle',
    entries: []
  }
  const store = new RuntimeEntryStore({
    index: runtime,
    source: () => new MemoryRangeSource(new Uint8Array())
  })
  const service = new ReplicaService({
    config,
    configId: 'config-1',
    configUrl: '/config.js',
    cacheKey: 'runtime:release-1',
    runtime,
    store
  })

  const pending = service.session({id: 'user-1', roles: ['editor']})
  await Promise.resolve()
  service.installRuntime(
    {...runtime, revision: 'tree-2'},
    'overlay',
    new Uint8Array()
  )
  release()
  const session = await pending

  expect(evaluations).toBe(2)
  expect(session.policy.canRead({id: 'evaluation-2'})).toBe(true)
  expect(session.policy.canRead({id: 'evaluation-1'})).toBe(false)
})

test('carries live entry overlay ciphertext with the filtered state', () => {
  const runtime: RuntimeDatabaseIndex = {
    revision: 'tree-1',
    bundleId: 'release-1',
    bundleUrl: '/admin/release-1/payload.bundle',
    entries: []
  }
  const store = new RuntimeEntryStore({
    index: runtime,
    source: () => ({
      async read() {
        return new Uint8Array()
      }
    })
  })
  const service = new ReplicaService({
    config: cms.config,
    configId: 'config-1',
    configUrl: '/admin/config/config-1/client-config.js',
    cacheKey: 'runtime:release-1',
    runtime,
    store
  })
  const entry = {
    kind: 'entry' as const,
    id: 'entry:page',
    queryable: true,
    entryId: 'page',
    versionStatus: 'published' as const,
    status: 'published' as const,
    active: true,
    main: true,
    type: 'Page',
    title: 'Page',
    seeded: null,
    workspace: 'main',
    root: 'pages',
    locale: null,
    level: 0,
    index: 'a0',
    parentId: null,
    parents: [],
    path: 'page',
    url: '/page',
    frames: {
      decodeKey: 'unused',
      data: {
        bundleId: 'overlay',
        bundleUrl: '/api?action=replicaBundle&bundle=overlay',
        offset: 0,
        length: 3,
        nonce: '',
        compression: 'none' as const
      }
    }
  }
  const next = {...runtime, revision: 'tree-2', entries: [entry]}
  next.source = {
    treeFrame: {
      decodeKey: 'source-key',
      frame: {
        bundleId: 'overlay',
        bundleUrl: '/api?action=replicaBundle&bundle=overlay',
        offset: 3,
        length: 4,
        nonce: '',
        compression: 'none'
      }
    }
  }
  const contents = new Uint8Array([1, 2, 3, 4, 5, 6, 7])
  service.installRuntime(next, 'overlay', contents)

  const state = service.state({
    user: {id: 'user-1', roles: ['admin']},
    policy: Policy.ALLOW_ALL,
    policyFingerprint: 'admin'
  })

  expect(base64.parse(state!.inlineBundles!.overlay)).toEqual(
    new Uint8Array([1, 2, 3])
  )
  expect(state!.runtime.entries[0].frames!.data).toMatchObject({
    offset: 0,
    length: 3
  })
  expect(state!.runtime.entries[0].frames!.data!.bundleUrl).toContain(
    'inline=tree-2%3Aadmin'
  )
  expect(service.bundleSize('overlay')).toBe(contents.length)
})

test('serves compacted overlay ciphertext without the source tree', async () => {
  const source = new FSSource('test/fixtures/demo')
  const release = await exportRuntimeDatabase({
    config: cms.config,
    bundleId: 'release',
    bundleUrl: '/payload.bundle',
    source,
    compression: 'none'
  })
  const target = release.index.entries.find(
    entry => entry.entryId === 'oi4qtV9YaXNRIUDT2s61Y' && entry.main
  )!
  const filePath = runtimeSourcePathResolver(
    cms.config,
    release.index.entries
  )(target)
  const tree = await source.getTree()
  const previousSha = tree.index().get(filePath)!
  const [[, previousContents]] = await Array.fromAsync(
    source.getBlobs([previousSha])
  )
  const raw = JSON.parse(new TextDecoder().decode(previousContents))
  raw.title = 'Changed title'
  const contents = new TextEncoder().encode(JSON.stringify(raw))
  const sha = await hashBlob(contents)
  const changes = {
    fromSha: tree.sha,
    changes: [{op: 'add' as const, path: filePath, sha, contents}]
  }
  const nextTree = await tree.withChanges(changes)
  const overlay = await exportRuntimeSourceChanges({
    config: cms.config,
    previous: release.index,
    tree: nextTree,
    changes,
    bundleId: 'overlay',
    bundleUrl: '/api?action=replicaBundle&bundle=overlay',
    compression: 'none'
  })
  const serverStore = new RuntimeEntryStore({
    index: release.index,
    source: () => new MemoryRangeSource(release.bundle)
  })
  const service = new ReplicaService({
    config: cms.config,
    configId: 'config-1',
    configUrl: '/config.js',
    cacheKey: 'runtime:release',
    runtime: release.index,
    store: serverStore
  })
  service.installRuntime(overlay.index, 'overlay', overlay.bundle)

  const state = service.state({
    user: {id: 'user-1', roles: ['admin']},
    policy: Policy.ALLOW_ALL,
    policyFingerprint: 'admin'
  })!
  const compacted = base64.parse(state.inlineBundles!.overlay)
  expect(compacted.length).toBeLessThan(overlay.bundle.length)
  const replicaStore = new RuntimeEntryStore({
    index: state.runtime,
    source: replicaRangeSource(
      state,
      () => new MemoryRangeSource(release.bundle)
    )
  })
  const resolver = new DatabaseResolver(cms.config, replicaStore)

  expect(
    await resolver.resolve({
      id: target.entryId,
      first: true,
      select: DemoRecipe.intro
    })
  ).toEqual(expect.any(Array))
})

test('bounds retired bundles while retaining recent in-flight sources', () => {
  const runtime: RuntimeDatabaseIndex = {
    revision: 'tree-1',
    bundleId: 'release-1',
    bundleUrl: '/payload.bundle',
    entries: []
  }
  const service = new ReplicaService({
    config: cms.config,
    configId: 'config-1',
    configUrl: '/config.js',
    cacheKey: 'runtime:release-1',
    runtime,
    store: new RuntimeEntryStore({
      index: runtime,
      source: () => ({
        async read() {
          return new Uint8Array()
        }
      })
    })
  })
  const frame = {
    bundleUrl: '/api?action=replicaBundle&bundle=overlay-1',
    offset: 0,
    length: 1,
    nonce: '',
    compression: 'none' as const
  }
  const entry = {
    kind: 'entry' as const,
    id: 'entry:page',
    queryable: true,
    entryId: 'page',
    versionStatus: 'published' as const,
    status: 'published' as const,
    active: true,
    main: true,
    type: 'Page',
    title: 'Page',
    seeded: null,
    workspace: 'main',
    root: 'pages',
    locale: null,
    level: 0,
    index: 'a0',
    parentId: null,
    parents: [],
    path: 'page',
    url: '/page'
  }
  service.installRuntime(
    {
      ...runtime,
      revision: 'tree-2',
      entries: [
        {
          ...entry,
          frames: {
            decodeKey: 'key-1',
            data: {...frame, bundleId: 'overlay-1'}
          }
        }
      ]
    },
    'overlay-1',
    new Uint8Array([1])
  )
  service.installRuntime(
    {
      ...runtime,
      revision: 'tree-3',
      entries: [
        {
          ...entry,
          frames: {
            decodeKey: 'key-2',
            data: {
              ...frame,
              bundleId: 'overlay-2',
              bundleUrl: '/api?action=replicaBundle&bundle=overlay-2'
            }
          }
        }
      ]
    },
    'overlay-2',
    new Uint8Array([2])
  )
  for (const number of [3, 4]) {
    const bundleId = `overlay-${number}`
    service.installRuntime(
      {
        ...runtime,
        revision: `tree-${number + 1}`,
        entries: [
          {
            ...entry,
            frames: {
              decodeKey: `key-${number}`,
              data: {
                ...frame,
                bundleId,
                bundleUrl: `/api?action=replicaBundle&bundle=${bundleId}`
              }
            }
          }
        ]
      },
      bundleId,
      new Uint8Array([number])
    )
  }

  expect(service.bundleSize('overlay-1')).toBeUndefined()
  expect(service.bundleSize('overlay-2')).toBe(1)
  expect(service.bundleSize('overlay-3')).toBe(1)
  expect(service.bundleSize('overlay-4')).toBe(1)
})

test('bounds settled transaction idempotency records without evicting pending work', async () => {
  const runtime: RuntimeDatabaseIndex = {
    revision: 'tree-1',
    bundleId: 'release-1',
    bundleUrl: '/payload.bundle',
    entries: []
  }
  const service = new ReplicaService({
    config: cms.config,
    configId: 'config-1',
    configUrl: '/config.js',
    cacheKey: 'runtime:release-1',
    runtime,
    transactionCacheSize: 1,
    store: new RuntimeEntryStore({
      index: runtime,
      source: () => ({
        async read() {
          return new Uint8Array()
        }
      })
    })
  })
  const session = {
    user: {id: 'user-1', roles: ['admin']},
    policy: Policy.ALLOW_ALL,
    policyFingerprint: 'admin'
  }
  let calls = 0
  const handler = async () => {
    calls++
    return {revision: runtime.revision, conflicts: []}
  }
  const transaction = (id: string) => ({
    id,
    baseRevision: runtime.revision,
    operations: []
  })

  await service.mutateWith(session, transaction('first'), handler)
  await service.mutateWith(session, transaction('first'), handler)
  await service.mutateWith(session, transaction('second'), handler)
  await service.mutateWith(session, transaction('first'), handler)

  expect(calls).toBe(3)
})
