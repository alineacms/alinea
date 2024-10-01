import {ReadableStream, Request, Response, TextEncoderStream} from '@alinea/iso'
import {HandlerWithConnect} from 'alinea/backend/Handler'
import {router} from 'alinea/backend/router/Router'
import {cloudUrl} from 'alinea/cloud/CloudConfig'
import {CMS} from 'alinea/core/CMS'
import {Trigger, trigger} from 'alinea/core/Trigger'
import {User} from 'alinea/core/User'
import {BuildOptions, BuildResult, OutputFile} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {Readable} from 'node:stream'
import {buildEmitter} from '../build/BuildEmitter.js'
import {ignorePlugin} from '../util/IgnorePlugin.js'
import {publicDefines} from '../util/PublicDefines.js'
import {reportHalt} from '../util/Report.js'
import {viewsPlugin} from '../util/ViewsPlugin.js'
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
    cmd,
    configLocation,
    rootDir,
    staticDir,
    alineaDev,
    buildOptions,
    production,
    liveReload
  }: ServeContext,
  cms: CMS,
  handleApi: HandlerWithConnect,
  user: User
): {
  close(): void
  handle(input: Request): Promise<Response>
} {
  function devHandler(request: Request) {
    return handleApi(request, {
      handlerUrl: new URL(request.url.split('?')[0]),
      apiKey: 'dev'
    })
  }
  if (cmd === 'build') return {close() {}, handle: devHandler}
  const devDir = path.join(staticDir, 'dev')
  const matcher = router.matcher()
  const entryPoints = {
    entry: 'alinea/cli/static/dashboard/dev',
    config: configLocation,
    views: viewsPlugin.entry
  }
  const tsconfigLocation = path.join(rootDir, 'tsconfig.json')
  const tsconfig = fs.existsSync(tsconfigLocation)
    ? tsconfigLocation
    : undefined
  let currentBuild: Trigger<BuildDetails> = trigger<BuildDetails>()
  let initial = true
  const plugins = buildOptions?.plugins || []
  plugins.push(viewsPlugin(rootDir, cms), ignorePlugin)
  const config = {
    format: 'esm',
    target: 'esnext',
    treeShaking: true,
    minify: true,
    splitting: true,
    sourcemap: true,
    outdir: devDir,
    bundle: true,
    absWorkingDir: rootDir,
    entryPoints,
    platform: 'browser',
    ...buildOptions,
    plugins,
    alias: {
      'alinea/next': 'alinea/core'
    },
    external: ['@alinea/generated'],
    inject: ['alinea/cli/util/WarnPublicEnv'],
    define: {
      'process.env.ALINEA_USER': JSON.stringify(JSON.stringify(user)),
      'process.env.NODE_ENV': production ? '"production"' : '"development"',
      'process.env.ALINEA_CLOUD_URL': cloudUrl
        ? JSON.stringify(cloudUrl)
        : 'undefined',
      ...publicDefines(process.env)
    },
    logOverride: {
      'ignored-bare-import': 'silent'
    },
    tsconfig,
    write: false
  } satisfies BuildOptions

  const builder = buildEmitter(config)

  ;(async () => {
    for await (const {type, result} of builder) {
      if (type === 'start') {
        if (initial) initial = false
        else currentBuild = trigger<BuildDetails>()
      } else {
        if (result.errors.length) {
          reportHalt('Building Alinea dashboard failed')
        } else {
          currentBuild.resolve(buildFiles(devDir, result))
          liveReload.reload(alineaDev ? 'reload' : 'refresh')
        }
      }
    }
  })()

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
      const stream = new ReadableStream<string>({
        start(controller) {
          liveReload.register({
            write: v => controller.enqueue(v),
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
    router.queryMatcher.post('/upload').map(async ({request, url}) => {
      if (!request.body) return new Response('No body', {status: 400})
      const file = url.searchParams.get('file')!
      const dir = path.join(rootDir, path.dirname(file))
      await fs.promises.mkdir(dir, {recursive: true})
      await fs.promises.writeFile(
        path.join(rootDir, file),
        Readable.fromWeb(request.body as any)
      )
      return new Response('Upload ok')
    }),
    router.compress(
      matcher.all('/api').map(async ({url, request}) => {
        return devHandler(request)
      }),
      matcher.get('/').map(({url}): Response => {
        const handlerUrl = `${url.protocol}//${url.host}`
        return new Response(
          `<!DOCTYPE html>
          <meta charset="utf-8" />
          <link rel="icon" href="data:," />
          <link href="/views.css" rel="stylesheet" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="handshake_url" value="${handlerUrl}?auth=handshake" />
          <meta name="redirect_url" value="${handlerUrl}?auth=login" />
          <body>
            <script type="module" src="./entry.js"></script>
          </body>`,
          {headers: {'content-type': 'text/html'}}
        )
      }),
      serveBrowserBuild
    )
  ).notFound(() => new Response('Not found', {status: 404}))

  return {
    close() {
      builder.return()
    },
    async handle(request: Request) {
      return (await httpRouter.handle(request))!
    }
  }
}
