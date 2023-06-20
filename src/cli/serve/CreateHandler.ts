import {ReadableStream, Request, Response, TextEncoderStream} from '@alinea/iso'
import {Handler} from 'alinea/backend'
import {router} from 'alinea/backend/router/Router'
import {Trigger, trigger} from 'alinea/core'
import esbuild, {BuildOptions, BuildResult} from 'esbuild'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {publicDefines} from '../util/PublicDefines.js'
import {ServeContext} from './ServeContext.js'

const require = createRequire(import.meta.url)

type BuildDetails = Map<string, Uint8Array>

// Source: https://github.com/evanw/esbuild/blob/71be8bc24e70609ab50a80e90a17a1f5770c89b5/internal/helpers/mime.go#L5
const mimeTypes = new Map(
  Object.entries({
    // Text
    '.css': 'text/css; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.mjs': 'text/javascript; charset=utf-8',
    '.xml': 'text/xml; charset=utf-8',

    // Images
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',

    // Fonts
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.sfnt': 'font/sfnt',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',

    // Other
    '.pdf': 'application/pdf',
    '.wasm': 'application/wasm'
  })
)

function buildFiles(outdir: string, result: BuildResult) {
  return new Map(
    result.outputFiles!.map(file => {
      return [
        file.path.slice(outdir.length).replace(/\\/g, '/').toLowerCase(),
        file.contents
      ]
    })
  )
}

export function createHandler(
  {
    rootDir: cwd,
    staticDir,
    alineaDev,
    buildOptions,
    production,
    liveReload
  }: ServeContext,
  handler: Handler
) {
  const devDir = path.join(staticDir, 'dev')
  const matcher = router.matcher()
  const entry = `alinea/cli/static/dashboard/dev`
  const altConfig = path.join(cwd, 'tsconfig.alinea.json')
  const tsconfig = fs.existsSync(altConfig) ? altConfig : undefined
  let currentBuild: Trigger<BuildDetails> = trigger<BuildDetails>(),
    initial = true

  const config = {
    external: [
      'next/navigation',
      'next/headers',
      'better-sqlite3',
      '@alinea/generated/store.js'
    ],
    format: 'esm',
    target: 'esnext',
    treeShaking: true,
    minify: true,
    splitting: true,
    sourcemap: true,
    outdir: devDir,
    bundle: true,
    absWorkingDir: cwd,
    entryPoints: {
      config: path.join(cwd, '.alinea/config.js'),
      entry
    },
    platform: 'browser',
    ...buildOptions,
    plugins: buildOptions?.plugins || [],
    define: {
      'process.env.NODE_ENV': production ? "'production'" : "'development'",
      ...publicDefines(process.env)
    },
    logOverride: {
      'ignored-bare-import': 'silent'
    },
    tsconfig,
    write: false
  } satisfies BuildOptions

  config.plugins.push({
    name: 'files',
    setup(build) {
      build.onStart(() => {
        if (initial) initial = false
        else currentBuild = trigger<BuildDetails>()
      })
      build.onEnd(result => {
        if (result.errors.length) {
          console.log('> building alinea dashboard failed')
        }
        currentBuild.resolve(buildFiles(devDir, result))
        if (alineaDev) liveReload.reload('reload')
      })
    }
  })

  /*const esbuildServer = esbuild.context(config).then(ctx => {
    return ctx.watch().then(() => ctx.serve())
  })

  async function forwardBuild(request: Request) {
    const {port} = await esbuildServer
    const url = new URL(request.url)
    url.host = '127.0.0.1'
    url.port = port.toString()
    return fetch(url, request)
  }*/

  esbuild.context(config).then(ctx => ctx.watch())

  async function serveBrowserBuild(
    request: Request
  ): Promise<Response | undefined> {
    let result = await currentBuild
    if (!result) return new Response('Build failed', {status: 500})
    const url = new URL(request.url)
    const fileName = url.pathname.toLowerCase()
    const contents = result.get(fileName)
    if (!contents) return undefined
    const extension = path.extname(fileName)
    return new Response(contents, {
      headers: {
        'content-type': mimeTypes.get(extension) || 'application/octet-stream'
      }
    })
  }

  return router(
    matcher.get('/~dev').map((): Response => {
      const stream = new ReadableStream({
        start(controller) {
          liveReload.register({
            // Todo: check types here
            write: v => controller.enqueue(v as any),
            close: () => controller.close()
          })
        }
      }).pipeThrough(new TextEncoderStream())
      return new Response(stream, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          'access-control-allow-origin': '*',
          Connection: 'keep-alive'
        }
      })
    }),
    router.compress(
      matcher.get('/').map(({url}): Response => {
        const handlerUrl = `${url.protocol}//${url.host}`
        return new Response(
          `<!DOCTYPE html>
          <meta charset="utf-8" />
          <link rel="icon" href="data:," />
          <link href="/config.css" rel="stylesheet" />
          <link href="/entry.css" rel="stylesheet" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="handshake_url" value="${handlerUrl}/hub/auth/handshake" />
          <meta name="redirect_url" value="${handlerUrl}/hub/auth" />
          <body>
            <script type="module" src="./entry.js"></script>
          </body>`,
          {
            headers: {'content-type': 'text/html'}
          }
        )
      }),
      matcher
        .all('/hub/*')
        .map(async ({request}): Promise<Response | undefined> => {
          return handler.handle(request)
        }),
      serveBrowserBuild,
      matcher.get('/config.css').map((): Response => {
        return new Response('', {headers: {'content-type': 'text/css'}})
      })
    )
  ).notFound(() => new Response('Not found', {status: 404}))
}
