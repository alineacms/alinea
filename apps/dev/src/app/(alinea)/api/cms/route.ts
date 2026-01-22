import {generatedSource} from 'alinea/backend/store/GeneratedSource'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {FSSource} from 'alinea/core/source/FSSource'
import {MemorySource} from 'alinea/core/source/MemorySource'
import {syncWith} from 'alinea/core/source/Source'
import {createHandler} from 'alinea/next'
import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'
import {cms} from '@/cms'

const source = await generatedSource
const db = new LocalDB(cms.config, source)
await db.sync()
//await db.logEntries()
await db.update({
  id: '2U6iFE1EOpe6RnrFORP7l8TFTCl',
  locale: 'en',
  set: {title: 'Updated'}
})

const server = setupServer(
  http.post('https://www.alinea.cloud/api/v1/tree', async () => {
    const tree = await db.getTreeIfDifferent('')
    return HttpResponse.json({success: true, data: tree})
  }),
  http.post('https://www.alinea.cloud/api/v1/blobs', async ({request}) => {
    const {shas} = (await request.json()) as {shas: Array<string>}
    const formData = new FormData()
    for await (const [sha, blob] of source.getBlobs(shas)) {
      formData.append(sha, new Blob([blob as BlobPart]))
    }
    return new Response(formData)
  })
)
server.listen({
  onUnhandledRequest: 'bypass'
})

const handler = createHandler({cms})
export const GET = handler
export const POST = handler
