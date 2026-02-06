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
