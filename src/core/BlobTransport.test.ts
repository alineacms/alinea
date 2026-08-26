import {suite} from '@alinea/suite'
import {decodeBlobSequence, encodeBlobSequence} from './BlobTransport.js'

const test = suite(import.meta)
const textEncoder = new TextEncoder()

test('roundtrips blob sequence', async () => {
  const firstSha = '1'.repeat(40)
  const secondSha = 'a'.repeat(40)
  const sequence = encodeBlobSequence(
    blobs([
      [firstSha, textEncoder.encode('first')],
      [secondSha, textEncoder.encode('second')]
    ])
  )

  const decoded = []
  for await (const blob of decodeBlobSequence(sequence)) decoded.push(blob)

  test.equal(decoded, [
    [firstSha, textEncoder.encode('first')],
    [secondSha, textEncoder.encode('second')]
  ])
})

test('rejects truncated blob sequence', async () => {
  const sequence = encodeBlobSequence(
    blobs([['1'.repeat(40), textEncoder.encode('contents')]])
  )
  const buffer = await new Response(sequence).arrayBuffer()
  const truncated = new Response(buffer.slice(0, -1)).body!

  await test.throws(() => collect(decodeBlobSequence(truncated)))
})

test('cancels blob sequence decoding', async () => {
  const sequence = encodeBlobSequence(
    blobs([['1'.repeat(40), textEncoder.encode('contents')]])
  )
  const controller = new AbortController()
  controller.abort(new Error('Cancelled blob transfer'))

  await test.throws(
    () => collect(decodeBlobSequence(sequence, {signal: controller.signal})),
    'Cancelled blob transfer'
  )
})

test('cancels the encoded source when decoding stops early', async () => {
  let cancelled = false
  async function* source(): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    try {
      yield ['1'.repeat(40), new Uint8Array(300_000)]
      yield ['2'.repeat(40), new Uint8Array(300_000)]
    } finally {
      cancelled = true
    }
  }

  for await (const _ of decodeBlobSequence(encodeBlobSequence(source()))) break

  test.is(cancelled, true)
})

async function* blobs(
  entries: Array<[sha: string, blob: Uint8Array]>
): AsyncGenerator<[sha: string, blob: Uint8Array]> {
  yield* entries
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<Array<T>> {
  const result = []
  for await (const value of iterable) result.push(value)
  return result
}
