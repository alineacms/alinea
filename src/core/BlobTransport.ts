import {ReadableStream} from '@alinea/iso'
import {
  type CBORValue,
  decodeAsyncIterable,
  encodeAsyncIterable
} from 'microcbor'
import type {GetBlobsOptions} from './source/Source.js'
import {assert} from './util/Assert.js'

export const BLOB_SEQUENCE_CONTENT_TYPE = 'application/cbor-seq'

const streamChunkSize = 256 * 1024

export function encodeBlobSequence(
  blobs: AsyncIterable<[sha: string, blob: Uint8Array]>
): ReadableStream<Uint8Array> {
  return iterableToStream(
    encodeAsyncIterable(blobRecords(blobs), {chunkSize: streamChunkSize})
  )
}

export async function* decodeBlobSequence(
  stream: ReadableStream<Uint8Array>,
  options: GetBlobsOptions = {}
): AsyncGenerator<[sha: string, blob: Uint8Array]> {
  const chunks = streamChunks(stream, options.signal)
  try {
    for await (const value of decodeAsyncIterable(chunks)) {
      assert(Array.isArray(value), 'Invalid blob sequence record')
      assert(value.length === 2, 'Invalid blob sequence record')
      const [sha, blob] = value
      assert(typeof sha === 'string', 'Invalid blob sequence sha')
      assert(/^[0-9a-f]{40}$/.test(sha), `Invalid blob sha: ${sha}`)
      assert(blob instanceof Uint8Array, `Invalid blob contents: ${sha}`)
      yield [sha, blob]
    }
  } finally {
    await chunks.return(undefined)
  }
}

async function* blobRecords(
  blobs: AsyncIterable<[sha: string, blob: Uint8Array]>
): AsyncGenerator<CBORValue> {
  for await (const [sha, blob] of blobs) {
    assert(/^[0-9a-f]{40}$/.test(sha), `Invalid blob sha: ${sha}`)
    yield [sha, blob]
  }
}

function iterableToStream(
  iterable: AsyncIterable<Uint8Array>
): ReadableStream<Uint8Array> {
  const iterator = iterable[Symbol.asyncIterator]()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next()
      if (next.done) controller.close()
      else controller.enqueue(next.value)
    },
    async cancel() {
      await iterator.return?.()
    }
  })
}

async function* streamChunks(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader()
  const cancel = () => void reader.cancel(signal?.reason)
  signal?.addEventListener('abort', cancel, {once: true})
  try {
    while (true) {
      throwIfAborted(signal)
      const next = await reader.read()
      throwIfAborted(signal)
      if (next.done) return
      yield next.value
    }
  } finally {
    signal?.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  throw signal.reason ?? new Error('Blob transfer aborted')
}
