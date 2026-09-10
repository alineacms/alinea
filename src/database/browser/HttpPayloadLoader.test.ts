import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import {Entry} from '#/core/Entry.js'
import {Permission} from '#/core/Role.js'
import {base64} from '#/core/util/Encoding.js'
import {config, entry, Page} from '#test/sqlite-browser/config.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {entryVersionId} from '../entry/Schema.js'
import {createFrameKey, encryptFrame} from '../replica/Frame.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import {ReplicaCache} from './ReplicaCache.js'
import {HttpPayloadLoader} from './HttpPayloadLoader.js'
import {decodePayloadBatch} from './DecodePayloadBatch.js'

const identity = {
  project: 'project',
  namespace: 'main',
  epoch: 'epoch',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release',
  principal: 'user',
  viewId: 'view'
}
const request = {
  versionId: entryVersionId('a', null, 'published'),
  payloadId: 'payload'
}
const expected = {identity, revision: 'r1', requests: [request]}

async function fixture() {
  const key = createFrameKey()
  const frame = await encryptFrame(
    {...identity, ...request, kind: 'data'},
    new TextEncoder().encode(JSON.stringify({data: {title: 'Private title'}})),
    key
  )
  const encoded = {
    descriptor: {
      ...frame.descriptor,
      nonce: base64.stringify(frame.descriptor.nonce)
    },
    key: base64.stringify(key),
    ciphertext: base64.stringify(frame.ciphertext)
  }
  return {
    frame,
    response: {version: 1, identity, revision: 'r1', frames: [encoded]}
  }
}

test('HTTP grants lazily hydrate WASM SQL and persist only authenticated ciphertext', async () => {
  const {frame, response} = await fixture()
  const cache = await ReplicaCache.open(new IDBFactory(), identity)
  const row = {
    entry: entry('a'),
    payloadId: request.payloadId,
    permissions: Permission.All,
    fields: {title: Permission.All}
  }
  await cache.apply({fromRevision: undefined, toRevision: 'r1', entries: [row]})
  let calls = 0
  const loader = new HttpPayloadLoader({
    url: 'https://example.com/api',
    identity,
    revision: 'r1',
    cache,
    applyAuth(init) {
      return {
        ...init,
        headers: {...init.headers, authorization: 'Bearer session'}
      }
    },
    async fetch(url, init) {
      calls++
      expect(url).toBe('https://example.com/api?action=replicaPayloads')
      expect(new Headers(init.headers).get('authorization')).toBe(
        'Bearer session'
      )
      expect(init.cache).toBe('no-store')
      expect(init.redirect).toBe('error')
      expect(JSON.parse(init.body as string)).toEqual(expected)
      return Response.json(response)
    }
  })
  const db = await wasmDatabase()
  try {
    await EntryRuntime.createSchema(db, 'empty')
    const runtime = new EntryRuntime(config, db, {
      load: requests => loader.load(requests)
    })
    await runtime.apply({
      fromRevision: 'empty',
      toRevision: 'r1',
      entries: [row]
    })
    expect(await runtime.find({select: Entry.id})).toEqual(['a'])
    expect(calls).toBe(0)
    const values = await Promise.all([
      runtime.find({select: Page.title}),
      runtime.find({select: Page.title})
    ])
    expect(values).toEqual([['Private title'], ['Private title']])
    expect(calls).toBe(1)
    expect(await cache.getFrames([request])).toEqual([
      {...request, ciphertext: frame.ciphertext}
    ])
    const concurrent = await Promise.all([
      loader.load([request]),
      loader.load([request])
    ])
    expect(concurrent[0]).toEqual(concurrent[1])
    expect(calls).toBe(2)
  } finally {
    loader.close()
    cache.close()
    await db.close()
  }
})

test('wire validation rejects foreign, duplicate, truncated and malformed envelopes', async () => {
  const {response} = await fixture()
  expect(decodePayloadBatch(response, expected)).toHaveLength(1)
  const cases: Array<unknown> = [
    {...response, version: 2},
    {...response, revision: 'old'},
    {...response, identity: {...identity, principal: 'another'}},
    {...response, identity: {...identity, namespace: 'another'}},
    {...response, frames: []},
    {...response, frames: [response.frames[0], response.frames[0]]},
    {...response, frames: [{...response.frames[0], ciphertext: ''}]},
    {...response, frames: [{...response.frames[0], key: 'invalid'}]},
    {
      ...response,
      frames: [
        {
          ...response.frames[0],
          descriptor: {...response.frames[0].descriptor, kind: 'unknown'}
        }
      ]
    },
    {
      ...response,
      frames: [
        {
          ...response.frames[0],
          descriptor: {...response.frames[0].descriptor, payloadId: 'another'}
        }
      ]
    },
    {
      ...response,
      frames: [
        {
          ...response.frames[0],
          descriptor: {...response.frames[0].descriptor, plaintextLength: -1}
        }
      ]
    }
  ]
  for (const value of cases)
    expect(() => decodePayloadBatch(value, expected)).toThrow()
})

test('authorization loss invalidates the session and prevents further network requests', async () => {
  let calls = 0
  let invalidated = 0
  const loader = new HttpPayloadLoader({
    url: 'https://example.com/api',
    identity,
    revision: 'r1',
    async fetch() {
      calls++
      return new Response(null, {status: 409})
    },
    onInvalidated(error) {
      expect(error.code).toBe(409)
      invalidated++
    }
  })
  await expect(loader.load([request])).rejects.toThrow('grant request failed')
  await expect(loader.load([request])).rejects.toThrow('closed')
  expect(calls).toBe(1)
  expect(invalidated).toBe(1)
})

test('close during an HTTP response prevents late hydration', async () => {
  const {response} = await fixture()
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const loader = new HttpPayloadLoader({
    url: 'https://example.com/api',
    identity,
    revision: 'r1',
    async fetch() {
      started.resolve()
      await resume.promise
      return Response.json(response)
    }
  })
  const pending = loader.load([request])
  await started.promise
  loader.close()
  resume.resolve()
  await expect(pending).rejects.toThrow('closed')
})
