import {expect, test} from 'bun:test'
import {replicaIdentity as identity} from '#test/sqlite-browser/config.js'
import {
  decodeReferenceBatch,
  decodeReferenceRequest,
  type ReferenceRequest,
  type ReferenceBatch
} from '../replica/ReferenceBatch.js'
import {fetchReferences} from './FetchReferences.js'

const request: ReferenceRequest = {
  identity,
  revision: 'revision',
  query: {targetId: 'target'}
}
const batch: ReferenceBatch = {
  identity,
  revision: request.revision,
  total: 1,
  scan: {scanned: 1, total: 1, complete: true},
  references: [
    {
      targetId: 'target',
      sourceId: 'source',
      sourceFilePath: 'source.json',
      sourceType: 'Page',
      sourceLocale: null,
      sourceStatus: 'published',
      sourceActive: true,
      sourceMain: true,
      fieldPath: 'related',
      linkType: 'entry'
    }
  ]
}

test('reference decoder rejects cross-view, partial and mismatched query results', () => {
  expect(decodeReferenceBatch(batch, request)).toEqual(batch)
  for (const key of Object.keys(identity) as Array<keyof typeof identity>)
    expect(() =>
      decodeReferenceBatch(
        {...batch, identity: {...identity, [key]: 'different'}},
        request
      )
    ).toThrow('binding')
  expect(() =>
    decodeReferenceBatch({...batch, revision: 'other'}, request)
  ).toThrow('binding')
  for (const value of [
    {...batch, total: 2},
    {...batch, scan: {...batch.scan, complete: false}},
    {...batch, scan: {...batch.scan, total: -1}},
    {...batch, references: [{...batch.references[0], targetId: 'other'}]},
    {...batch, references: [{...batch.references[0], sourceStatus: 'draft'}]},
    {...batch, references: [{...batch.references[0], linkType: 'other'}]}
  ])
    expect(() => decodeReferenceBatch(value, request)).toThrow('Invalid')
  expect(() =>
    decodeReferenceBatch(batch, {
      ...request,
      query: {...request.query, locale: 'de'}
    })
  ).toThrow('Invalid')
  expect(() =>
    decodeReferenceRequest({
      ...request,
      query: {targetId: 'target', status: 'invalid'}
    })
  ).toThrow('Invalid')
})

test('reference transport is authenticated, bounded and non-cacheable without hydrating payloads', async () => {
  let calls = 0
  const result = await fetchReferences(
    {
      url: 'https://cms.test/api',
      applyAuth: init => ({
        ...init,
        headers: {...init.headers, authorization: 'Bearer session'}
      }),
      async fetch(url, init) {
        calls++
        expect(new URL(url).searchParams.get('action')).toBe(
          'replicaReferences'
        )
        expect(init.method).toBe('POST')
        expect(init.cache).toBe('no-store')
        expect(init.redirect).toBe('error')
        expect(new Headers(init.headers).get('authorization')).toBe(
          'Bearer session'
        )
        expect(JSON.parse(String(init.body))).toEqual(request)
        return Response.json(batch)
      }
    },
    request,
    new AbortController().signal
  )
  expect(result).toEqual(batch)
  expect(calls).toBe(1)
})

test('reference transport rejects oversized bodies and aborts before issuing a request', async () => {
  const options = {
    url: 'https://cms.test/api',
    async fetch() {
      return new Response(new Uint8Array(32 * 1024 * 1024 + 1), {
        headers: {'content-type': 'application/json'}
      })
    }
  }
  await expect(
    fetchReferences(options, request, new AbortController().signal)
  ).rejects.toThrow()
  const abort = new AbortController()
  abort.abort(new Error('closed'))
  let calls = 0
  await expect(
    fetchReferences(
      {
        ...options,
        async fetch() {
          calls++
          return Response.json(batch)
        }
      },
      request,
      abort.signal
    )
  ).rejects.toThrow('closed')
  expect(calls).toBe(0)
})
