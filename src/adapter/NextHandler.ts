import {Database} from 'alinea/backend'
import {generatedStore} from 'alinea/backend/Store'
import PLazy from 'p-lazy'
import {createCloudHandler} from '../cloud/server/CloudHandler.js'
import {NextCMS} from './NextCMS.js'

const handlers = new WeakMap<NextCMS, (request: Request) => Promise<Response>>()

export function createHandler(cms: NextCMS) {
  if (handlers.has(cms)) return handlers.get(cms)!
  const apiKey = process.env.ALINEA_API_KEY
  const cloudHandler = PLazy.from(async () => {
    const db = new Database(cms.config, await generatedStore)
    return createCloudHandler(cms.config, db, apiKey)
  })
  const handle = async (request: Request): Promise<Response> => {
    const {searchParams} = new URL(request.url)
    const previewToken = searchParams.get('preview')
    if (previewToken) return cms.handlePreview(request)
    const {router} = await cloudHandler
    const response = await router.handle(request)
    if (response) return response
    return new Response('Not found', {status: 404})
  }
  handlers.set(cms, handle)
  return handle
}
