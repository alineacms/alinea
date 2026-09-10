import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import pLimit from 'p-limit'
import {Client} from '#/core/Client.js'
import {Permission} from '#/core/Role.js'
import {
  config,
  replicaIdentity as identity
} from '#test/sqlite-browser/config.js'
import {ReplicaWorkerHost} from './ReplicaWorkerHost.js'

function batch() {
  const {project, namespace, epoch} = identity
  return {
    config,
    local: true,
    revision: 'compiled-config',
    handlerUrl: 'https://cms.test/api',
    replica: {project, namespace, epoch},
    client: new Client({config, url: 'https://cms.test/api'}),
    views: {}
  }
}

test('dedicated host pins generated configuration and cannot be shared between principals', async () => {
  let calls = 0
  const serial = pLimit(1)
  const host = new ReplicaWorkerHost(batch(), {
    indexedDB: new IDBFactory(),
    lock: (_name, run) => serial(run),
    async fetch() {
      calls++
      return Response.json({
        version: 1,
        identity,
        revision: 'source',
        permissions: Permission.All,
        scopePolicy: {root: Permission.All, entries: []},
        entries: []
      })
    }
  })
  await expect(
    host.connect(identity.principal, 'wrong-config')
  ).rejects.toThrow('configuration mismatch')
  expect(calls).toBe(0)
  const first = await host.connect(identity.principal, 'compiled-config')
  expect(await host.connect(identity.principal, 'compiled-config')).toBe(first)
  expect(calls).toBe(1)
  await expect(host.connect('other', 'compiled-config')).rejects.toThrow(
    'another principal'
  )
  await host.close(true)
  await expect(
    host.connect(identity.principal, 'compiled-config')
  ).rejects.toThrow('closed')
})

test('host close cancels startup and cannot expose a late query endpoint', async () => {
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const host = new ReplicaWorkerHost(batch(), {
    indexedDB: new IDBFactory(),
    async fetch() {
      started.resolve()
      await resume.promise
      return Response.json({
        version: 1,
        identity,
        revision: 'source',
        permissions: Permission.All,
        scopePolicy: {root: Permission.All, entries: []},
        entries: []
      })
    }
  })
  const opening = host
    .connect(identity.principal, 'compiled-config')
    .catch(error => error)
  await started.promise
  const closing = host.close(true)
  resume.resolve()
  await closing
  expect(await opening).toBeInstanceOf(Error)
})

test('host accepts calls before config loads and closes without waiting for the import', async () => {
  const config = Promise.withResolvers<ReturnType<typeof batch>>()
  const host = new ReplicaWorkerHost(config.promise)
  const opening = host
    .connect(identity.principal, 'compiled-config')
    .catch(error => error)
  await host.close(true)
  config.resolve(batch())
  expect(await opening).toMatchObject({
    message: 'Replica worker host is closed'
  })
})

test('host reports dynamic configuration failures to the connecting client', async () => {
  const config = Promise.withResolvers<ReturnType<typeof batch>>()
  const host = new ReplicaWorkerHost(config.promise)
  const opening = host.connect(identity.principal, 'compiled-config')
  config.reject(new Error('Config import failed'))
  await expect(opening).rejects.toThrow('Config import failed')
  await host.close()
})
