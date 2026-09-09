import {concatUint8Arrays} from '../source/Utils.js'

/** Bound the bytes actually consumed, including chunked bodies without a length. */
export async function readBody(
  body: ReadableStream<Uint8Array>,
  maximum: number,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const reader = body.getReader()
  const chunks: Array<Uint8Array> = []
  let length = 0
  const abort = () => {
    void reader.cancel(signal?.reason).catch(() => {})
  }
  signal?.addEventListener('abort', abort, {once: true})
  try {
    for (;;) {
      signal?.throwIfAborted()
      const chunk = await reader.read()
      signal?.throwIfAborted()
      if (chunk.done) return concatUint8Arrays(chunks)
      length += chunk.value.length
      if (length > maximum) throw new Error('Body exceeds byte limit')
      chunks.push(chunk.value)
    }
  } finally {
    signal?.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
