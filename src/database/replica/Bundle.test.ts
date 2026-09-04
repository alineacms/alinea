import {suite} from '@alinea/suite'
import {
  BundleFrameLoader,
  encryptFrame,
  MemoryRangeSource,
  packEncryptedFrames
} from './Bundle.js'

const test = suite(import.meta)
const encoder = new TextEncoder()
const decoder = new TextDecoder()

test('range loads and decrypts only granted frames', async () => {
  const editorialKey = new Uint8Array(32).fill(7)
  const legalKey = new Uint8Array(32).fill(11)
  const editorial = await encryptFrame({
    bundleId: 'release-1',
    id: 'entry-editorial',
    accessClassId: 'editorial',
    key: editorialKey,
    contents: encoder.encode('Editorial content')
  })
  const legal = await encryptFrame({
    bundleId: 'release-1',
    id: 'entry-legal',
    accessClassId: 'legal',
    key: legalKey,
    contents: encoder.encode('Legal content')
  })
  const bundle = packEncryptedFrames([editorial, legal])
  const loader = new BundleFrameLoader(
    'release-1',
    new MemoryRangeSource(bundle.contents),
    [{accessClassId: 'editorial', key: editorialKey}]
  )

  test.equal(
    decoder.decode(await loader.load(bundle.frames[0])),
    'Editorial content'
  )
  await test.throws(
    () => loader.load(bundle.frames[1]),
    'Missing grant for access class "legal"'
  )
})

test('authenticates ciphertext and frame metadata', async () => {
  const key = new Uint8Array(32).fill(19)
  const encrypted = await encryptFrame({
    bundleId: 'release-1',
    id: 'entry-a',
    accessClassId: 'editors',
    key,
    contents: encoder.encode('Content'),
    compression: 'deflate'
  })
  const bundle = packEncryptedFrames([encrypted])
  const tampered = bundle.contents.slice()
  tampered[0] ^= 1
  const loader = new BundleFrameLoader(
    'release-1',
    new MemoryRangeSource(tampered),
    [{accessClassId: 'editors', key}]
  )

  await test.throws(
    () => loader.load(bundle.frames[0]),
    'Invalid hash for frame "entry-a"'
  )
})

test('coalesces adjacent frame reads', async () => {
  const key = new Uint8Array(32).fill(23)
  const encrypted = await Promise.all(
    ['one', 'two', 'three'].map(id =>
      encryptFrame({
        bundleId: 'release-1',
        id,
        accessClassId: id,
        key,
        contents: encoder.encode(id),
        compression: 'none'
      })
    )
  )
  const bundle = packEncryptedFrames(encrypted)
  const reads: Array<{offset: number; length: number}> = []
  const loader = new BundleFrameLoader(
    'release-1',
    {
      async read(offset, length) {
        reads.push({offset, length})
        return bundle.contents.slice(offset, offset + length)
      }
    },
    encrypted.map(frame => ({accessClassId: frame.accessClassId, key}))
  )

  const loaded = await loader.loadMany(bundle.frames)

  test.equal(reads, [{offset: 0, length: bundle.contents.length}])
  test.equal(
    bundle.frames.map(frame => decoder.decode(loaded.get(frame.id))),
    ['one', 'two', 'three']
  )
})
