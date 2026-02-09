import {generatedSource} from 'alinea/backend/store/GeneratedSource'
import {Entry} from 'alinea/core/Entry'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {createHandler} from 'alinea/next'
import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'
import {cms} from '@/cms'

const source = await generatedSource
const db = new LocalDB(cms.config, source)
await db.sync()
const rootPage = await db.get({
  path: 'root-page',
  locale: 'en',
  select: {id: Entry.id}
})
await db.update({
  id: rootPage.id,
  locale: 'en',
  set: {title: 'Updated'}
})

const server = setupServer(
  http.post('https://www.alinea.cloud/api/v1/tree', async ({request}) => {
    const {sha} = (await request.json()) as {sha: string}
    const tree = await db.getTreeIfDifferent(sha)
    return HttpResponse.json({success: true, data: tree ?? null})
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
