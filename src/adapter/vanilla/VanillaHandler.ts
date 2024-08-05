import {Request} from '@alinea/iso'
import {Database} from 'alinea/backend'
import {generatedStore} from 'alinea/backend/Store'
import {createCloudHandler} from 'alinea/cloud/server/CloudHandler'
import PLazy from 'p-lazy'
import {VanillaCMS} from './VanillaCMS.js'

const handlers = new WeakMap<
  VanillaCMS,
  (request: Request) => Promise<Response>
>()

export function createHandler(cms: VanillaCMS) {
  if (handlers.has(cms)) return handlers.get(cms)!
  const apiKey = process.env.ALINEA_API_KEY
  const cloudHandler = PLazy.from(async () => {
    const db = new Database(cms.config, await generatedStore)
    return createCloudHandler(cms.config, db, apiKey)
  })
  const handle = async (request: Request): Promise<Response> => {
    const {router} = await cloudHandler
    const response = await router.handle(request)
    if (response) return response
    return new Response('Not found', {status: 404})
  }
  handlers.set(cms, handle)
  return handle
}

/*

createHandler(
  cms,
  ({request, env}) => cloudBackend(env.ALINEA_API_KEY)
)

*/
