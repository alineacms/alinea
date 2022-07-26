import {backend} from '@alinea/content/backend.js'
import {Request, Response} from '@alinea/iso'

export default async (req: Request) => {
  const response = await backend.handle(req)
  if (response === undefined) return new Response('Not found', {status: 404})
  return response
}

export const config = {
  runtime: 'experimental-edge',
  // We disable the body parser that is added by Next.js as it incorrectly parses
  // application/octet-stream as string.
  api: {bodyParser: false}
}
