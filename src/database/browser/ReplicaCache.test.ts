import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import {Permission} from '#/core/Role.js'
import {entry} from '#test/sqlite-browser/config.js'
import {entryVersionId} from '../entry/Schema.js'
import {
  ReplicaCache,
  type CachedEntry,
  type ReplicaIdentity
} from './ReplicaCache.js'

const identity: ReplicaIdentity = {
  project: 'project',
  namespace: 'main',
  epoch: 'epoch',
  schemaId: 'schema',
  configId: 'config',
  principal: 'user',
  viewId: 'policy',
  releaseId: 'release'
}
const a = entryVersionId('a', null, 'published')

function row(id: string, payloadId = id): CachedEntry {
  return {
    entry: entry(id),
    permissions: Permission.Explore | Permission.Read,
    payloadId
  }
}

test('persists exact payloads and evicts changed descriptors', async () => {
  const factory = new IDBFactory()
  const cache = await ReplicaCache.open(factory, identity)
  await cache.apply({
    fromRevision: undefined,
    toRevision: 'r1',
    entries: [row('a')]
  })
  const payload = {versionId: a, payloadId: 'a', dataJson: '{"title":"A"}'}
  await cache.putPayloads('r1', [payload])
  cache.close()

  const reopened = await ReplicaCache.open(factory, identity)
  expect(await reopened.getPayloads([payload])).toEqual([payload])
  await reopened.apply({
    fromRevision: 'r1',
    toRevision: 'r2',
    entries: [row('a', 'new')]
  })
  expect(await reopened.getPayloads([payload])).toEqual([])
  await expect(reopened.putPayloads('r1', [payload])).rejects.toThrow('Stale')
  reopened.close()
})

test('rejects payloads that are not readable in the current index', async () => {
  const cache = await ReplicaCache.open(new IDBFactory(), identity)
  await cache.apply({
    fromRevision: undefined,
    toRevision: 'r1',
    entries: [{entry: entry('a'), permissions: Permission.Explore}]
  })
  await expect(
    cache.putPayloads('r1', [
      {versionId: a, payloadId: 'a', dataJson: '{"title":"A"}'}
    ])
  ).rejects.toThrow('readable descriptor')
  cache.close()
})

test('scope purge invalidates matching identities only', async () => {
  const factory = new IDBFactory()
  const own = await ReplicaCache.open(factory, identity)
  const other = await ReplicaCache.open(factory, {
    ...identity,
    principal: 'other'
  })
  for (const cache of [own, other])
    await cache.apply({
      fromRevision: undefined,
      toRevision: 'r1',
      entries: [row('a')]
    })
  await ReplicaCache.purgeScope(factory, identity)
  await expect(own.snapshot()).rejects.toThrow('invalidated')
  expect((await other.snapshot()).entries).toHaveLength(1)
  own.close()
  other.close()
})

test('aborting a payload transaction prevents installation', async () => {
  const cache = await ReplicaCache.open(new IDBFactory(), identity)
  await cache.apply({
    fromRevision: undefined,
    toRevision: 'r1',
    entries: [row('a')]
  })
  const controller = new AbortController()
  controller.abort(new Error('Revoked'))
  const payload = {versionId: a, payloadId: 'a', dataJson: '{"title":"A"}'}
  await expect(
    cache.putPayloads('r1', [payload], controller.signal)
  ).rejects.toThrow('Revoked')
  expect(await cache.getPayloads([payload])).toEqual([])
  cache.close()
})
