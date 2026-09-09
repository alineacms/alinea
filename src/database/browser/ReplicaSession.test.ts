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
import {fetchBootstrap} from './FetchBootstrap.js'

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

test('connect authenticates bootstrap before opening a queryable lazy session', async () => {
  const {bootstrap, response} = await fixture()
  const calls: Array<string> = []
  const session = await ReplicaSession.connect({
    config,
    expected: identity,
    url: 'https://example.com/api',
    applyAuth(init) {
      const headers = new Headers(init.headers)
      headers.set('authorization', 'Bearer user')
      return {...init, headers}
    },
    async fetch(url, init) {
      const action = new URL(url).searchParams.get('action')!
      calls.push(action)
      expect(init.method).toBe('POST')
      expect(init.cache).toBe('no-store')
      expect(init.redirect).toBe('error')
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer user')
      return Response.json(action === 'replicaIndex' ? bootstrap : response)
    }
  })
  try {
    expect(calls).toEqual(['replicaIndex'])
    expect(await session.find({select: Entry.id})).toEqual(['a'])
    expect(calls).toEqual(['replicaIndex'])
    expect(await session.find({select: Page.title})).toEqual([
      'Private payload'
    ])
    expect(calls).toEqual(['replicaIndex', 'replicaPayloads'])
  } finally {
    await session.close()
  }
})

test('bootstrap requests fail closed on auth, malformed and oversized responses', async () => {
  const {bootstrap} = await fixture()
  for (const response of [
    new Response(null, {status: 401}),
    new Response('invalid', {headers: {'content-type': 'application/json'}}),
    Response.json({...bootstrap, identity: {...identity, namespace: 'wrong'}}),
    new Response('{}', {headers: {'content-type': 'text/html'}})
  ]) {
    await expect(
      ReplicaSession.connect({
        config,
        expected: identity,
        url: 'https://example.com/api',
        async fetch() {
          return response
        }
      })
    ).rejects.toThrow()
  }
  let cancelled = false
  await expect(
    fetchBootstrap({
      expected: identity,
      url: 'https://example.com/api',
      maximumBytes: 8,
      async fetch() {
        return new Response(
          new ReadableStream({
            pull(controller) {
              controller.enqueue(new Uint8Array(9))
            },
            cancel() {
              cancelled = true
            }
          }),
          {headers: {'content-type': 'application/json'}}
        )
      }
    })
  ).rejects.toThrow('byte limit')
  expect(cancelled).toBe(true)
})

test('bootstrap cancellation stops pending streams and refuses late responses', async () => {
  const {bootstrap} = await fixture()
  const abort = new AbortController()
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  let cancelled = false
  const pending = ReplicaSession.connect({
    config,
    expected: identity,
    url: 'https://example.com/api',
    signal: abort.signal,
    async fetch() {
      started.resolve()
      await resume.promise
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify(bootstrap))
            )
          },
          cancel() {
            cancelled = true
          }
        }),
        {headers: {'content-type': 'application/json'}}
      )
    }
  })
  await started.promise
  abort.abort(new Error('Cancelled startup'))
  resume.resolve()
  await expect(pending).rejects.toThrow('Cancelled startup')
  expect(cancelled).toBe(true)
  let calls = 0
  await expect(
    ReplicaSession.connect({
      config,
      expected: identity,
      url: 'https://example.com/api',
      signal: abort.signal,
      async fetch() {
        calls++
        return Response.json(bootstrap)
      }
    })
  ).rejects.toThrow('Cancelled startup')
  expect(calls).toBe(0)
})
