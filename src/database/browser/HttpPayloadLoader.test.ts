import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import {Permission} from '#/core/Role.js'
import {entry} from '#test/sqlite-browser/config.js'
import {entryVersionId} from '../entry/Schema.js'
import {decodePayloadStream} from './DecodePayloadBatch.js'
import {HttpPayloadLoader} from './HttpPayloadLoader.js'
import {ReplicaCache} from './ReplicaCache.js'

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
  payloadId: 'payload-a'
}
const second = {
  versionId: entryVersionId('b', null, 'published'),
  payloadId: 'payload-b'
}
const expected = {identity, revision: 'r1', requests: [request, second]}

function payloadResponse(requests = expected.requests): Response {
  const lines = [
    JSON.stringify({version: 1, identity, revision: 'r1'}),
    ...requests.map(
      row =>
        `${JSON.stringify(row.versionId)}\t${JSON.stringify(row.payloadId)}\t${JSON.stringify({title: row.payloadId})}\tnull`
    )
  ]
  return new Response(lines.join('\n') + '\n', {
    headers: {'content-type': 'application/x-alinea-payloads'}
  })
}

test('coalesces cold payloads into one streamed request and persists exact rows', async () => {
  const cache = await ReplicaCache.open(new IDBFactory(), identity)
  await cache.apply({
    fromRevision: undefined,
    toRevision: 'r1',
    entries: [
      {
        entry: entry('a'),
        payloadId: request.payloadId,
        permissions: Permission.All
      },
      {
        entry: entry('b'),
        payloadId: second.payloadId,
        permissions: Permission.All
      }
    ]
  })
  let calls = 0
  const loader = new HttpPayloadLoader({
    url: 'https://example.com/api',
    identity,
    revision: 'r1',
    cache,
    async fetch(url, init) {
      calls++
      expect(url).toBe('https://example.com/api?action=replicaPayloads')
      expect(JSON.parse(init.body as string)).toEqual(expected)
      return payloadResponse()
    }
  })
  try {
    const [a, b] = await Promise.all([
      loader.load([request]),
      loader.load([second])
    ])
    expect(a[0].dataJson).toBe('{"title":"payload-a"}')
    expect(b[0].dataJson).toBe('{"title":"payload-b"}')
    expect(calls).toBe(1)
    await loader.flushCache()
    expect(await cache.getPayloads([request, second])).toHaveLength(2)
    await loader.load([request, second])
    expect(calls).toBe(1)
  } finally {
    loader.close()
    cache.close()
  }
})

test('stream validation rejects a foreign identity and incomplete rows', async () => {
  const header = JSON.stringify({
    version: 1,
    identity: {...identity, principal: 'other'},
    revision: 'r1'
  })
  const foreign = new Response(header + '\n')
  await expect(decodePayloadStream(foreign.body!, expected)).rejects.toThrow(
    'identity mismatch'
  )
  const incomplete = payloadResponse([request])
  await expect(decodePayloadStream(incomplete.body!, expected)).rejects.toThrow(
    'Incomplete'
  )
})

test('authorization loss invalidates the loader', async () => {
  let invalidated = 0
  const loader = new HttpPayloadLoader({
    url: 'https://example.com/api',
    identity,
    revision: 'r1',
    async fetch() {
      return new Response(null, {status: 409})
    },
    onInvalidated() {
      invalidated++
    }
  })
  await expect(loader.load([request])).rejects.toThrow('Payload request failed')
  await expect(loader.load([request])).rejects.toThrow('closed')
  expect(invalidated).toBe(1)
})

test('oversized batches split and retry automatically', async () => {
  let calls = 0
  const loader = new HttpPayloadLoader({
    url: 'https://example.com/api',
    identity,
    revision: 'r1',
    async fetch(_url, init) {
      calls++
      const body = JSON.parse(init.body as string)
      return body.requests.length > 1
        ? new Response(null, {status: 413})
        : payloadResponse(body.requests)
    }
  })
  try {
    expect(await loader.load([request, second])).toHaveLength(2)
    expect(calls).toBe(3)
  } finally {
    loader.close()
  }
})
