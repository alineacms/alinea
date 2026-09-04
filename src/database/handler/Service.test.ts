import {expect, test} from 'bun:test'
import {Policy} from '#/core/Role.js'
import {ReplicaService} from './Service.js'
import type {RuntimeDatabaseIndex} from '../runtime/Model.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {base64} from '#/core/util/Encoding.js'
import {cms} from '#test/cms.js'

test('projects a runtime replica directly from the generated index', () => {
  const runtime: RuntimeDatabaseIndex = {
    version: 1,
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
            id: 'data:example',
            accessClassId: 'read:example',
            offset: 0,
            length: 1,
            nonce: '',
            cipherHash: 'cipher',
            compression: 'none'
          }
        }
      }
    ],
    children: {},
    source: {tree: {sha: 'tree-1', entries: []}, blobs: {}}
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
  expect(service.state(session, 'tree-1')).toBeUndefined()
})

test('carries live entry overlay ciphertext with the filtered state', () => {
  const runtime: RuntimeDatabaseIndex = {
    version: 1,
    revision: 'tree-1',
    bundleId: 'release-1',
    bundleUrl: '/admin/release-1/payload.bundle',
    entries: [],
    children: {}
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
        id: 'data:page',
        bundleId: 'overlay',
        bundleUrl: '/api?action=replicaBundle&bundle=overlay',
        accessClassId: 'read:page',
        offset: 0,
        length: 3,
        nonce: '',
        cipherHash: 'cipher',
        compression: 'none' as const
      }
    }
  }
  const next = {...runtime, revision: 'tree-2', entries: [entry]}
  const contents = new Uint8Array([1, 2, 3])
  service.installRuntimeOverlay(next, 'overlay', contents)

  const state = service.state({
    user: {id: 'user-1', roles: ['admin']},
    policy: Policy.ALLOW_ALL,
    policyFingerprint: 'admin'
  })

  expect(base64.parse(state!.inlineBundles!.overlay)).toEqual(contents)
})
