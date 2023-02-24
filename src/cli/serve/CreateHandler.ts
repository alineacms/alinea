import {ReadableStream, Request, Response, TextEncoderStream} from '@alinea/iso'
import {router} from 'alinea/backend/router/Router'
import semver from 'compare-versions'
import esbuild, {BuildResult} from 'esbuild'
import {createRequire} from 'node:module'
import path from 'node:path'
import {publicDefines} from '../util/PublicDefines'
import {ServeContext} from './ServeContext'
import {ServeBackend} from './backend/ServeBackend'

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
    cwd,
    staticDir,
    alineaDev,
    buildOptions,
    production,
    liveReload
  }: ServeContext,
  server: ServeBackend
) {
  const {version} = require('react/package.json')
  const isReact18 = semver.compare(version, '18.0.0', '>=')
  const react = isReact18 ? 'react18' : 'react'

  const devDir = path.join(staticDir, 'dev')
  const matcher = router.matcher()
  const entry = `alinea/dashboard/dev/${alineaDev ? 'Dev' : 'Lib'}Entry`

  let frontend: Promise<BuildDetails | undefined> = esbuild
    .build({
      ignoreAnnotations: alineaDev,
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
      inject: [path.join(staticDir, `render/render-${react}.js`)],
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
      tsconfig: path.join(staticDir, 'tsconfig.json'),
      write: false,
      watch: alineaDev
        ? {
            onRebuild(_, result) {
              if (result) {
                frontend = Promise.resolve(buildFiles(devDir, result))
                liveReload.reload('reload')
              }
            }
          }
        : undefined
    })
    .then(result => buildFiles(devDir, result))
    .catch(() => undefined)

  async function serveBrowserBuild(
    request: Request
  ): Promise<Response | undefined> {
    let result = await frontend
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
    // router.compress(
    matcher.get('/').map(({url}): Response => {
      const handlerUrl = `${url.protocol}//${url.host}`
      return new Response(
        `<!DOCTYPE html>
          <meta charset="utf-8" />
          <link rel="icon" href="data:," />
          <link href="./config.css" rel="stylesheet" />
          <link href="./entry.css" rel="stylesheet" />
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
        return server.handle(request)
      }),
    serveBrowserBuild,
    matcher.get('/config.css').map((): Response => {
      return new Response('', {headers: {'content-type': 'text/css'}})
    })
    // )
  ).notFound(() => new Response('Not found', {status: 404}))
}
