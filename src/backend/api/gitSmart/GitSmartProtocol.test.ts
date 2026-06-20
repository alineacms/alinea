import {suite} from '@alinea/suite'
import {
  buildReceivePackRequest,
  buildUploadPackRequest,
  flushPkt,
  parseAdvertisement,
  parseReceivePackStatus,
  pktLine
} from './GitSmartProtocol.js'
import {
  hashCommitObject,
  type GitSignature,
  serializeCommitObject
} from './GitSmartObjects.js'

const test = suite(import.meta)
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const author: GitSignature = {name: 'Ben', email: 'ben@example.com'}

test('pkt-line advertisement parsing preserves refs and capabilities', () => {
  const data = concat([
    pktLine('# service=git-upload-pack\n'),
    flushPkt(),
    pktLine(
      'abc refs/heads/main\0side-band-64k ofs-delta allow-reachable-sha1-in-want\n'
    ),
    pktLine('def refs/heads/dev\n')
  ])
  const advertisement = parseAdvertisement(data)
  test.is(advertisement.refs.get('refs/heads/main'), 'abc')
  test.is(advertisement.refs.get('refs/heads/dev'), 'def')
  test.ok(advertisement.capabilities.has('side-band-64k'))
  test.ok(advertisement.capabilities.has('allow-reachable-sha1-in-want'))
})

test('upload-pack and receive-pack requests encode wants and ref updates', () => {
  const upload = decoder.decode(
    buildUploadPackRequest(['a'.repeat(40), 'b'.repeat(40)], new Set(['ofs-delta']))
  )
  test.ok(upload.includes(`want ${'a'.repeat(40)} ofs-delta no-progress`))
  test.ok(upload.includes(`want ${'b'.repeat(40)}`))
  const receive = decoder.decode(
    buildReceivePackRequest({
      oldSha: 'a'.repeat(40),
      newSha: 'b'.repeat(40),
      ref: 'refs/heads/main',
      capabilities: new Set(['report-status', 'ofs-delta']),
      pack: encoder.encode('PACK')
    }).subarray(0, 200)
  )
  test.ok(receive.includes(`refs/heads/main\0report-status ofs-delta`))
})

test('receive-pack status parsing captures unpack and ref errors', () => {
  const payload = pktLine(
    withChannel(1, encoder.encode('unpack ok\nng refs/heads/main non-fast-forward\n'))
  )
  const status = parseReceivePackStatus(concat([payload, flushPkt()]))
  test.is(status.unpackStatus, 'ok')
  test.is(status.refStatus.get('refs/heads/main'), 'non-fast-forward')
})

test('commit object serialization hashes deterministically', async () => {
  const data = serializeCommitObject({
    tree: 'a'.repeat(40),
    parent: 'b'.repeat(40),
    message: 'Hello',
    author,
    date: new Date('2024-01-01T00:00:00.000Z')
  })
  const text = decoder.decode(data)
  test.ok(text.includes(`tree ${'a'.repeat(40)}`))
  test.ok(text.includes(`parent ${'b'.repeat(40)}`))
  test.ok(text.includes('author Ben <ben@example.com> 1704067200 +0000'))
  const hash = await hashCommitObject({
    tree: 'a'.repeat(40),
    parent: 'b'.repeat(40),
    message: 'Hello',
    author,
    date: new Date('2024-01-01T00:00:00.000Z')
  })
  test.is(hash.length, 40)
})

function concat(parts: Array<Uint8Array>) {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function withChannel(channel: number, payload: Uint8Array) {
  const out = new Uint8Array(payload.length + 1)
  out[0] = channel
  out.set(payload, 1)
  return out
}
