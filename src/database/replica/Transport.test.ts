import {expect, test} from 'bun:test'
import {Response} from '@alinea/iso'
import {
  createFrameKey,
  decryptFrame,
  encryptFrame,
  type FrameIdentity
} from './Frame.js'
import {HttpFrameReader, HttpRangeSource, packFrames} from './Transport.js'

const identity: FrameIdentity = {
  project: 'project',
  namespace: 'main',
  epoch: 'epoch',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release',
  versionId: 'a',
  payloadId: 'payload',
  kind: 'data'
}
const url = 'https://cdn.example.test/bundle.bin'

test('packed encrypted frames are selected by exact byte ranges and decrypt independently', async () => {
  const key = createFrameKey()
  const first = await encryptFrame(identity, new Uint8Array([1, 2]), key)
  const second = await encryptFrame(
    {...identity, versionId: 'b'},
    new Uint8Array([3, 4]),
    key
  )
  const bundle = packFrames([first, second])
  const ranges: Array<string> = []
  const reader = new HttpFrameReader(
    bundle.locations.map(location => ({...location, url})),
    {
      async fetch(input, init) {
        expect(String(input)).toBe(url)
        expect(init?.credentials).toBe('omit')
        expect(init?.redirect).toBe('error')
        const range = new Headers(init?.headers).get('range')!
        ranges.push(range)
        const [, start, end] = /^bytes=(\d+)-(\d+)$/.exec(range)!
        return new Response(
          bundle.contents.slice(Number(start), Number(end) + 1),
          {
            status: 206,
            headers: {
              'content-range': `bytes ${start}-${end}/${bundle.contents.length}`
            }
          }
        )
      }
    }
  )
  const bytes = await reader.read(second.descriptor)
  expect(ranges).toEqual([
    `bytes=${first.ciphertext.length}-${bundle.contents.length - 1}`
  ])
  expect(
    await decryptFrame(second.descriptor, second.descriptor, bytes, key)
  ).toEqual(new Uint8Array([3, 4]))
  await expect(
    reader.read({...second.descriptor, namespace: 'other'})
  ).rejects.toThrow('location')
  expect(() => packFrames([first, first])).toThrow('Duplicate')
  expect(() => packFrames([first], 1)).toThrow('limit')
})

test('range responses reject wrong status, bounds, length and transfer encoding', async () => {
  for (const response of [
    new Response(new Uint8Array([1, 2, 3])),
    new Response(new Uint8Array([1, 2, 3]), {status: 206}),
    new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: {'content-range': 'bytes 1-3/4'}
    }),
    new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: {'content-range': 'bytes 0-2/2'}
    }),
    new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: {'content-range': 'bytes 0-2/4', 'content-length': '4'}
    }),
    new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: {'content-range': 'bytes 0-2/4', 'content-encoding': 'gzip'}
    }),
    new Response(new Uint8Array([1, 2]), {
      status: 206,
      headers: {'content-range': 'bytes 0-2/4'}
    })
  ]) {
    const source = new HttpRangeSource(url, {fetch: async () => response})
    await expect(source.read(0, 3)).rejects.toThrow()
  }
})

test('oversized streamed responses are cancelled even without a declared length', async () => {
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(8))
    },
    cancel() {
      cancelled = true
    }
  })
  const source = new HttpRangeSource(url, {
    fetch: async () =>
      new Response(body, {
        status: 206,
        headers: {'content-range': 'bytes 0-2/4'}
      })
  })
  await expect(source.read(0, 3)).rejects.toThrow('byte limit')
  expect(cancelled).toBe(true)
})

test('full responses require an explicit limit and still return only the requested bytes', async () => {
  const source = new HttpRangeSource(url, {
    maximumFullResponseBytes: 4,
    fetch: async () => new Response(new Uint8Array([1, 2, 3, 4]))
  })
  expect(await source.read(1, 2)).toEqual(new Uint8Array([2, 3]))
  const oversized = new HttpRangeSource(url, {
    maximumFullResponseBytes: 2,
    fetch: async () => new Response(new Uint8Array([1, 2, 3]))
  })
  await expect(oversized.read(0, 1)).rejects.toThrow('byte limit')
})

test('abort cancels a pending response stream and invalid ranges never fetch', async () => {
  let calls = 0
  let cancelled = false
  const started = Promise.withResolvers<void>()
  const source = new HttpRangeSource(url, {
    async fetch() {
      calls++
      return new Response(
        new ReadableStream<Uint8Array>({
          pull() {
            started.resolve()
          },
          cancel() {
            cancelled = true
          }
        }),
        {status: 206, headers: {'content-range': 'bytes 0-2/4'}}
      )
    }
  })
  await expect(source.read(-1, 1)).rejects.toThrow('range')
  await expect(source.read(Number.MAX_SAFE_INTEGER, 1)).rejects.toThrow('range')
  expect(await source.read(0, 0)).toEqual(new Uint8Array())
  expect(calls).toBe(0)
  const controller = new AbortController()
  const pending = source.read(0, 3, controller.signal)
  const outcome = pending.then(
    () => undefined,
    error => error
  )
  await started.promise
  controller.abort(new Error('Revoked'))
  expect(await outcome).toMatchObject({message: 'Revoked'})
  expect(cancelled).toBe(true)
})
