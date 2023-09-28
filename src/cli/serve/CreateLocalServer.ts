import {ReadableStream, Request, Response, TextEncoderStream} from '@alinea/iso'
import {Handler} from 'alinea/backend'
import {HttpHandler, router} from 'alinea/backend/router/Router'
import {Trigger, trigger} from 'alinea/core'
import esbuild, {BuildOptions, BuildResult, OutputFile} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {Readable} from 'node:stream'
import {publicDefines} from '../util/PublicDefines.js'
import {ServeContext} from './ServeContext.js'

type BuildDetails = Map<string, OutputFile>

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
        file
      ]
    })
  )
}

export function createLocalServer(
  {
    rootDir: cwd,
    staticDir,
    alineaDev,
    buildOptions,
    production,
    liveReload
  }: ServeContext,
  handler: Handler
): HttpHandler {
  const devDir = path.join(staticDir, 'dev')
  const matcher = router.matcher()
  const entry = `alinea/cli/static/dashboard/dev`
  const altConfig = path.join(cwd, 'tsconfig.alinea.json')
  const tsconfig = fs.existsSync(altConfig) ? altConfig : undefined
  let currentBuild: Trigger<BuildDetails> = trigger<BuildDetails>(),
    initial = true
  const cloudUrl = process.env.ALINEA_CLOUD_URL
    ? `'${process.env.ALINEA_CLOUD_URL}'`
    : 'undefined'
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
      config: '@alinea/generated/config.js',
      entry
    },
    platform: 'browser',
    ...buildOptions,
    plugins: buildOptions?.plugins || [],
    define: {
      'process.env.NODE_ENV':
        production || process.env.ALINEA_CLOUD_URL
          ? "'production'"
          : "'development'",
      'process.env.ALINEA_CLOUD_URL': cloudUrl,
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

  esbuild.context(config).then(ctx => ctx.watch())

  async function serveBrowserBuild(
    request: Request
  ): Promise<Response | undefined> {
    let result = await currentBuild
    if (!result) return new Response('Build failed', {status: 500})
    const url = new URL(request.url)
    const fileName = url.pathname.toLowerCase()
    const file = result.get(fileName)
    if (!file) return undefined
    const ifNoneMatch = request.headers.get('if-none-match')
    const etag = `"${file.hash}"`
    if (ifNoneMatch && ifNoneMatch === etag)
      return new Response(undefined, {status: 304})
    const extension = path.extname(fileName)
    return new Response(file.contents, {
      headers: {
        'content-type': mimeTypes.get(extension) || 'application/octet-stream',
        etag
      }
    })
  }

  const httpRouter = router(
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
    matcher.post('/upload').map(async ({request, url}) => {
      if (!request.body) return new Response('No body', {status: 400})
      const file = url.searchParams.get('file')!
      const dir = path.join(cwd, path.dirname(file))
      await fs.promises.mkdir(dir, {recursive: true})
      await fs.promises.writeFile(
        path.join(cwd, file),
        Readable.fromWeb(request.body as any)
      )
      return new Response('Upload ok')
    }),
    matcher.get('/preview').map(async ({request, url}) => {
      return new Response()
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

  return async (request: Request) => {
    return (await httpRouter.handle(request))!
  }
}
