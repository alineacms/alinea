import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import {Entry} from '#/core/Entry.js'
import {Permission} from '#/core/Role.js'
import {base64} from '#/core/util/Encoding.js'
import {
  config,
  entry,
  Page,
  replicaIdentity as identity
} from '#test/sqlite-browser/config.js'
import {entryIndexRow} from '../entry/Schema.js'
import {createFrameKey, encryptFrame} from '../replica/Frame.js'
import {decodeBootstrap} from './DecodeBootstrap.js'
import {ReplicaCache} from './ReplicaCache.js'
import {ReplicaSession} from './ReplicaSession.js'

async function fixture() {
  const {versionId, ...indexed} = entryIndexRow(entry('a'))
  const request = {versionId, payloadId: 'payload'}
  const key = createFrameKey()
  const frame = await encryptFrame(
    {...identity, ...request, kind: 'data'},
    new TextEncoder().encode(
      JSON.stringify({data: {title: 'Private payload'}})
    ),
    key
  )
  const bootstrap = {
    version: 1,
    identity,
    revision: 'r1',
    permissions: Permission.All,
    entries: [
      {
        entry: indexed,
        permissions: Permission.All,
        fields: {title: Permission.All},
        payloadId: 'payload'
      }
    ]
  }
  const response = {
    version: 1,
    identity,
    revision: 'r1',
    frames: [
      {
        descriptor: {
          ...frame.descriptor,
          nonce: base64.stringify(frame.descriptor.nonce)
        },
        key: base64.stringify(key),
        ciphertext: base64.stringify(frame.ciphertext)
      }
    ]
  }
  return {bootstrap, response, request, frame}
}

test('session bootstraps lazily, reopens from authenticated rows and purges after ordinary close', async () => {
  const {bootstrap, response, request, frame} = await fixture()
  const indexedDB = new IDBFactory()
  let calls = 0
  const options = {
    config,
    bootstrap,
    expected: identity,
    indexedDB,
    url: 'https://example.com/api',
    async fetch() {
      calls++
      return Response.json(response)
    }
  }
  const first = await ReplicaSession.open(options)
  try {
    expect(await first.find({select: Entry.id})).toEqual(['a'])
    expect(calls).toBe(0)
    expect(await first.find({select: Page.title})).toEqual(['Private payload'])
    expect(calls).toBe(1)
    const view = first.bootstrap
    view.entries.length = 0
    expect(first.bootstrap.entries).toHaveLength(1)
  } finally {
    await first.close()
  }
  await expect(first.count({})).rejects.toThrow('closed')
  expect(() => first.bootstrap).toThrow('closed')
  const cache = await ReplicaCache.open(indexedDB, identity)
  expect(await cache.getFrames([request])).toEqual([
    {...request, ciphertext: frame.ciphertext}
  ])
  cache.close()
  const next = await ReplicaSession.open(options)
  try {
    expect(await next.find({select: Entry.id})).toEqual(['a'])
    expect(await next.find({select: Page.title})).toEqual(['Private payload'])
    expect(calls).toBe(2) // A fresh session still requires a fresh authorized key.
  } finally {
    await next.close()
  }
  await next.close(true)
  const purged = await ReplicaCache.open(indexedDB, identity)
  expect(await purged.snapshot()).toEqual({revision: undefined, entries: []})
  purged.close()
})

test('revocation closes the Graph immediately and drains before purging its cache', async () => {
  const {bootstrap} = await fixture()
  const indexedDB = new IDBFactory()
  let invalidated = 0
  const session = await ReplicaSession.open({
    config,
    bootstrap,
    expected: identity,
    indexedDB,
    url: 'https://example.com/api',
    async fetch() {
      return new Response(null, {status: 403})
    },
    onInvalidated() {
      invalidated++
    }
  })
  await expect(session.find({select: Page.title})).rejects.toThrow()
  await expect(session.find({select: Entry.id})).rejects.toThrow('closed')
  await session.close()
  expect(invalidated).toBe(1)
  const cache = await ReplicaCache.open(indexedDB, identity)
  expect(await cache.snapshot()).toEqual({revision: undefined, entries: []})
  cache.close()
})

test('bootstrap decoding rejects invalid authority and projects out payload properties', async () => {
  const {bootstrap} = await fixture()
  const extra = structuredClone(bootstrap)
  Object.assign(extra.entries[0].entry, {
    data: {secret: 'must not persist'},
    fileHash: 'private'
  })
  expect(decodeBootstrap(extra, identity).entries[0].entry).not.toHaveProperty(
    'data'
  )
  expect(decodeBootstrap(extra, identity).entries[0].entry).not.toHaveProperty(
    'fileHash'
  )
  const bad: Array<unknown> = [
    {...bootstrap, version: 2},
    {...bootstrap, identity: {...identity, principal: 'other'}},
    {...bootstrap, entries: [...bootstrap.entries, ...bootstrap.entries]},
    {
      ...bootstrap,
      entries: [{...bootstrap.entries[0], permissions: Permission.Read}]
    },
    {
      ...bootstrap,
      entries: [{...bootstrap.entries[0], fields: {title: Permission.Explore}}]
    },
    {
      ...bootstrap,
      entries: [
        {
          ...bootstrap.entries[0],
          entry: {...bootstrap.entries[0].entry, status: 'invalid'}
        }
      ]
    }
  ]
  for (const value of bad)
    expect(() => decodeBootstrap(value, identity)).toThrow()
})

test('closing during a payload fetch gates new reads and drains the late result', async () => {
  const {bootstrap, response} = await fixture()
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const session = await ReplicaSession.open({
    config,
    bootstrap,
    expected: identity,
    url: 'https://example.com/api',
    async fetch() {
      started.resolve()
      await resume.promise
      return Response.json(response)
    }
  })
  const pending = session.find({select: Page.title})
  await started.promise
  const closing = session.close()
  let closed = false
  void closing.then(() => {
    closed = true
  })
  await Promise.resolve()
  expect(closed).toBe(false)
  await expect(session.find({select: Entry.id})).rejects.toThrow('closed')
  resume.resolve()
  await expect(pending).rejects.toThrow()
  await closing
  expect(closed).toBe(true)
})
