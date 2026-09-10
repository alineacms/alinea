import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import {Permission} from '#/core/Role.js'
import {entry} from '#test/sqlite-browser/config.js'
import {entryVersionId} from '../entry/Schema.js'
import {
  ReplicaCache,
  type ReplicaIdentity,
  type CachedEntry
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
const b = entryVersionId('b', null, 'published')

test('scope purge clears every policy/release generation without touching another owner', async () => {
  const factory = new IDBFactory()
  const identities = [
    identity,
    {...identity, viewId: 'old-policy', releaseId: 'old-release'},
    {...identity, principal: 'other'},
    {...identity, namespace: 'preview'},
    {...identity, epoch: 'other'},
    {...identity, project: 'other'}
  ]
  const caches = await Promise.all(
    identities.map(id => ReplicaCache.open(factory, id))
  )
  try {
    for (const cache of caches) {
      await cache.apply({
        fromRevision: undefined,
        toRevision: 'r1',
        entries: [row('a')]
      })
      await cache.putFrames('r1', [
        {versionId: a, payloadId: 'a', ciphertext: new Uint8Array([1])}
      ])
    }
    await ReplicaCache.purgeScope(factory, identity)
    for (const cache of caches.slice(0, 2))
      await expect(cache.snapshot()).rejects.toThrow('invalidated')
    for (let i = 0; i < identities.length; i++) {
      const reopened = await ReplicaCache.open(factory, identities[i])
      try {
        const snapshot = await reopened.snapshot()
        expect(snapshot.entries).toHaveLength(i < 2 ? 0 : 1)
        expect(
          await reopened.getFrames([{versionId: a, payloadId: 'a'}])
        ).toHaveLength(i < 2 ? 0 : 1)
      } finally {
        reopened.close()
      }
    }
  } finally {
    for (const cache of caches) cache.close()
  }
})

test('aborting an in-flight ciphertext transaction prevents installation', async () => {
  const cache = await ReplicaCache.open(new IDBFactory(), identity)
  try {
    await cache.apply({
      fromRevision: undefined,
      toRevision: 'r1',
      entries: [row('a')]
    })
    const controller = new AbortController()
    const request = {
      versionId: a,
      payloadId: 'a',
      ciphertext: new Uint8Array([1])
    }
    const pending = cache.putFrames('r1', [request], controller.signal)
    controller.abort(new Error('Revoked'))
    await expect(pending).rejects.toThrow('Revoked')
    expect(await cache.getFrames([request])).toEqual([])
  } finally {
    cache.close()
  }
})
function row(id: string, payloadId = id): CachedEntry {
  return {
    entry: entry(id),
    permissions: Permission.Explore | Permission.Read,
    fields: {title: Permission.Explore | Permission.Read},
    payloadId
  }
}

test('cache reopens a committed structural index without storing plaintext fields', async () => {
  const factory = new IDBFactory()
  const cache = await ReplicaCache.open(factory, identity)
  const extended = {
    ...entry('a'),
    data: {secret: 'not an index field'},
    searchableText: 'private'
  }
  await cache.apply({
    fromRevision: undefined,
    toRevision: 'r1',
    entries: [{...row('a'), entry: extended}, row('b')]
  })
  const frame = {
    versionId: a,
    payloadId: 'a',
    ciphertext: new Uint8Array([1, 2, 3])
  }
  await cache.putFrames('r1', [frame])
  cache.close()
  const reopened = await ReplicaCache.open(factory, identity)
  try {
    const snapshot = await reopened.snapshot()
    expect(snapshot.revision).toBe('r1')
    expect(snapshot.entries).toHaveLength(2)
    expect(snapshot.entries[0].fields.title & Permission.Update).toBe(0)
    expect(JSON.stringify(snapshot)).not.toContain('private')
    expect(JSON.stringify(snapshot)).not.toContain('secret')
    expect(JSON.stringify(snapshot)).not.toContain('ciphertext')
    expect(
      await reopened.getFrames([
        {versionId: a, payloadId: 'a'},
        {versionId: b, payloadId: 'b'}
      ])
    ).toEqual([frame])
    expect(
      await reopened.getFrames([{versionId: a, payloadId: 'old'}])
    ).toEqual([])
  } finally {
    reopened.close()
  }
})

test('cache updates retain exact payloads, evict changed descriptors and revoke read access', async () => {
  const cache = await ReplicaCache.open(new IDBFactory(), identity)
  try {
    await cache.apply({
      fromRevision: undefined,
      toRevision: 'r1',
      entries: [row('a'), row('b')]
    })
    const frame = {
      versionId: a,
      payloadId: 'a',
      ciphertext: new Uint8Array([1])
    }
    await cache.putFrames('r1', [
      frame,
      {versionId: b, payloadId: 'b', ciphertext: new Uint8Array([2])}
    ])
    await cache.apply({
      fromRevision: 'r1',
      toRevision: 'r2',
      entries: [row('a'), row('b', 'new')]
    })
    expect(
      await cache.getFrames([frame, {versionId: b, payloadId: 'b'}])
    ).toEqual([frame])
    await expect(cache.putFrames('r1', [frame])).rejects.toThrow('Stale')
    await expect(
      cache.putFrames('r2', [
        {versionId: b, payloadId: 'b', ciphertext: new Uint8Array([3])}
      ])
    ).rejects.toThrow('descriptor')
    await cache.apply({
      fromRevision: 'r2',
      toRevision: 'r3',
      entries: [
        {
          entry: entry('a'),
          permissions: Permission.Explore,
          fields: {title: Permission.Explore}
        }
      ],
      removedVersionIds: [b]
    })
    expect(await cache.getFrames([frame])).toEqual([])
    expect((await cache.snapshot()).entries).toHaveLength(1)
    await expect(cache.putFrames('r3', [frame])).rejects.toThrow('descriptor')
  } finally {
    cache.close()
  }
})

test('cache batches roll back rows, ciphertext and revision on invalid grants or duplicates', async () => {
  const cache = await ReplicaCache.open(new IDBFactory(), identity)
  try {
    await cache.apply({
      fromRevision: undefined,
      toRevision: 'r1',
      entries: [row('a')]
    })
    await expect(
      cache.apply({
        fromRevision: 'r1',
        toRevision: 'bad',
        entries: [row('b'), row('b')],
        removedVersionIds: [a]
      })
    ).rejects.toThrow('Duplicate')
    expect((await cache.snapshot()).revision).toBe('r1')
    await expect(
      cache.apply({
        fromRevision: 'r1',
        toRevision: 'bad-fields',
        entries: [{...row('a'), fields: {title: Permission.Explore}}]
      })
    ).rejects.toThrow('unreadable field')
    expect((await cache.snapshot()).entries.map(row => row.entry.id)).toEqual([
      'a'
    ])
    await expect(
      cache.apply({
        fromRevision: 'r1',
        toRevision: 'bad',
        entries: [{...row('b'), permissions: Permission.Read}]
      })
    ).rejects.toThrow('explore')
    await expect(
      cache.apply({
        fromRevision: 'r1',
        toRevision: 'bad',
        entries: [{...row('b'), permissions: Permission.Explore}]
      })
    ).rejects.toThrow('read permission')
    const frame = {
      versionId: a,
      payloadId: 'a',
      ciphertext: new Uint8Array([1])
    }
    await expect(
      cache.putFrames('r1', [
        frame,
        {versionId: b, payloadId: 'b', ciphertext: new Uint8Array([2])}
      ])
    ).rejects.toThrow('descriptor')
    expect(await cache.getFrames([frame])).toEqual([])
  } finally {
    cache.close()
  }
})

test('every replica identity dimension partitions cache state', async () => {
  const factory = new IDBFactory()
  const cache = await ReplicaCache.open(factory, identity)
  try {
    await cache.apply({
      fromRevision: undefined,
      toRevision: 'r1',
      entries: [row('a')]
    })
    for (const key of Object.keys(identity) as Array<keyof ReplicaIdentity>) {
      const other = await ReplicaCache.open(factory, {
        ...identity,
        [key]: `${identity[key]}:other`
      })
      try {
        expect(await other.snapshot()).toEqual({
          revision: undefined,
          entries: []
        })
      } finally {
        other.close()
      }
    }
  } finally {
    cache.close()
  }
})

test('cross-tab writes use exact-base CAS and purge invalidates existing handles', async () => {
  const factory = new IDBFactory()
  const first = await ReplicaCache.open(factory, identity)
  const second = await ReplicaCache.open(factory, identity)
  try {
    const results = await Promise.allSettled([
      first.apply({
        fromRevision: undefined,
        toRevision: 'r1',
        entries: [row('a')]
      }),
      second.apply({
        fromRevision: undefined,
        toRevision: 'r2',
        entries: [row('b')]
      })
    ])
    expect(results.map(result => result.status).sort()).toEqual([
      'fulfilled',
      'rejected'
    ])
    const {revision} = await first.snapshot()
    await first.purge()
    await expect(second.snapshot()).rejects.toThrow('invalidated')
    await expect(
      second.apply({
        fromRevision: revision,
        toRevision: 'stale',
        entries: [row('a')]
      })
    ).rejects.toThrow('invalidated')
    await expect(
      second.putFrames(revision!, [
        {versionId: a, payloadId: 'a', ciphertext: new Uint8Array([1])}
      ])
    ).rejects.toThrow('invalidated')
    const fresh = await ReplicaCache.open(factory, identity)
    try {
      expect(await fresh.snapshot()).toEqual({revision: undefined, entries: []})
    } finally {
      fresh.close()
    }
  } finally {
    first.close()
    second.close()
  }
})
