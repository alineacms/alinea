import {suite} from '@alinea/suite'
import {decodePreviewPayload, encodePreviewPayload} from './PreviewPayload.js'

const test = suite(import.meta)

test('roundtrips preview payload patch bytes', async () => {
  const update = {
    locale: 'en',
    entryId: 'entry-id',
    contentHash: 'content-hash',
    status: 'draft',
    patch: new Uint8Array([1, 2, 3, 254, 255])
  }
  const payload = await encodePreviewPayload(update)
  const decoded = await decodePreviewPayload(payload)
  test.equal(decoded, update)
})

test('roundtrips a record delta', async () => {
  const update = {
    version: 2 as const,
    locale: null,
    entryId: 'entry-id',
    contentHash: 'content-hash',
    status: 'published',
    fileHash: 'file-hash',
    delta: new Uint8Array([1, 2, 3]),
    record: {_id: 'entry-id', _type: 'Page', _index: 'a0', title: 'Draft'}
  }
  const decoded = await decodePreviewPayload(await encodePreviewPayload(update))
  test.equal(decoded, update)
})
