import {backend} from '@alinea/content/backend.js'

//export default nodeHandler(backend.handle)

export default async (req: Request) => {
  const response = await backend.handle(req)
  if (response === undefined) return new Response('Not found', {status: 404})
  return response
}

export const config = {
  // Unfortunately we can't enable this just yet, the edge runtime cannot be
  // conditionally targeted (vercel/next.js#39075).
  // We also have a few more places where client code leaks into server side
  // (see MediaSchema view, and CloudAuthView)

  runtime: 'experimental-edge',

  // We disable the body parser that is added by Next.js as it incorrectly
  // parses application/octet-stream as string.

  api: {bodyParser: false}
}
