// import {nodeHandler} from 'alinea/backend/router/NodeHandler'
// import {backend} from '@alinea/content/backend.js'
// export default nodeHandler(backend.handle)

export default async (req: Request) => {
  const {backend} = await import('@alinea/content/backend')
  const response = await backend.handle(req)
  if (response === undefined) return new Response('Not found', {status: 404})
  return response
}

export const config = {
  // Things we run into enabling this:
  // - The edge runtime cannot be conditionally targeted (vercel/next.js#39075).
  //   I've enabled the worker condition in the custom webpack config in
  //   next.config.js which seems to currectly stop browser code from being
  //   bundled.
  // - The @alinea/sqlite-wasm package needs to load some wasm. It currently has
  //   two strategies to load wasm:
  //   - base64 => ArrayBuffer => WebAssembly.instantiate
  //      => not allowed in the runtime (cf worker)
  //   - import _ from './file.wasm'
  //      => works with wrangler on cloudflare workers but not for
  //         next.js/vercel. Vercel claims to support './file.wasm?module' now -
  //         we need to figure out how to make webpack output that cleanly
  //         instead of trying to bundle the wasm file.

  runtime: 'experimental-edge',

  // We disable the body parser that is added by Next.js as it incorrectly
  // parses application/octet-stream as string.

  api: {bodyParser: false}
}
