import {nodeHandler} from '@alinea/backend/router/NodeHandler'
import {router} from '@alinea/backend/router/Router'
import {createDb} from '@alinea/backend/util/CreateDb'
import {ReadableStream, Request, Response, TextEncoderStream} from '@alinea/iso'
import semver from 'compare-versions'
import esbuild, {BuildOptions, BuildResult} from 'esbuild'
import fs from 'node:fs'
import http, {IncomingMessage, RequestListener, ServerResponse} from 'node:http'
import {createRequire} from 'node:module'
import path from 'node:path'
import {buildOptions} from './build/BuildOptions'
import {generate} from './Generate'
import {ServeBackend} from './serve/ServeBackend'
import {dirname} from './util/Dirname'

const __dirname = dirname(import.meta.url)
const require = createRequire(import.meta.url)

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

type Client = {
  write(value: string): void
  close(): void
}

type BuildDetails = {
  rebuild: () => Promise<BuildDetails>
  files: Map<string, Uint8Array>
}

function browserBuild(
  options: BuildOptions
): (request: Request) => Promise<Response> {
  let frontend: Promise<BuildDetails> = esbuild
    .build({
      ...options,
      write: false,
      incremental: true
    })
    .then(buildFiles)
  let frontendBuilt = Date.now()
  function buildFiles(result: BuildResult) {
    return {
      rebuild: () => result.rebuild!().then(buildFiles),
      files: new Map(
        result.outputFiles!.map(file => {
          return [
            file.path
              .slice(options.outdir!.length)
              .replace(/\\/g, '/')
              .toLowerCase(),
            file.contents
          ]
        })
      )
    }
  }
  return async function serveBrowserBuild(request: Request): Promise<Response> {
    let result = await frontend
    const isResultStale = Date.now() - frontendBuilt > 1000
    if (isResultStale) {
      frontend = result.rebuild!()
      frontendBuilt = Date.now()
      result = await frontend
    }
    const url = new URL(request.url)
    const fileName = url.pathname.toLowerCase()
    const contents = result.files.get(fileName)
    if (!contents) return new Response('Not found', {status: 404})
    const extension = path.extname(fileName)
    return new Response(contents, {
      headers: {
        'content-type': mimeTypes.get(extension) || 'application/octet-stream'
      }
    })
  }
}

async function startServer(
  handler: RequestListener,
  preferredPort = 4500
): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler)
    server.on('error', reject)
    server.on('listening', () => resolve(server))
    server.listen(preferredPort)
  })
    .then(() => preferredPort)
    .catch(err => {
      const incrementedPort = preferredPort + 1
      if (err.code === 'EADDRINUSE' && incrementedPort < 65535) {
        console.log(
          `> Port ${preferredPort} is in use, attempting ${incrementedPort} instead`
        )
        return startServer(handler, incrementedPort)
      }
      throw err
    })
}

export type ServeOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  port?: number
  buildOptions?: BuildOptions
  alineaDev?: boolean
  production?: boolean
  onAfterGenerate?: () => void
}

export async function serve(options: ServeOptions): Promise<void> {
  const {
    cwd = process.cwd(),
    staticDir = path.join(__dirname, 'static'),
    alineaDev = false,
    production = false
  } = options
  const preferredPort = options.port ? Number(options.port) : 4500
  const port = await startServer(serve, preferredPort)
  const dashboardName = production ? '(production) dashboard' : 'dashboard'
  console.log(`> Alinea ${dashboardName} available on http://localhost:${port}`)
  let setHandler: (handler: RequestListener) => void | undefined
  const handler = new Promise<RequestListener>(
    resolve => (setHandler = resolve)
  )

  function serve(req: IncomingMessage, res: ServerResponse) {
    handler.then(handler => handler(req, res))
  }

  const store = await createDb()
  const clients: Array<Client> = []
  const {version} = require('react/package.json')
  const isReact18 = semver.compare(version, '18.0.0', '>=')
  const react = isReact18 ? 'react18' : 'react'

  function reload(type: 'refetch' | 'refresh' | 'reload') {
    for (const client of clients) {
      client.write(`data: ${type}\n\n`)
      if (type === 'reload') client.close()
    }
    if (type === 'reload') clients.length = 0
  }

  let server: ServeBackend

  let config = await generate({
    ...options,
    store,
    onConfigRebuild: async outcome => {
      const [newConfig, error] = outcome
      if (error) return
      config = newConfig
      server.reload(newConfig)
      if (!alineaDev) reload('refresh')
    },
    onCacheRebuild: async outcome => {
      const [store, error] = outcome
      if (error) return
      await server.reloadPreviewStore()
      reload('refetch')
    }
  })

  fs.writeFileSync(
    path.join(cwd, '.alinea/drafts.js'),
    `export const serverLocation = 'http://localhost:${port}'`
  )

  server = new ServeBackend({
    cwd,
    port,
    config,
    store
  })

  const devDir = path.join(staticDir, 'dev')
  const matcher = router.matcher()
  const entry = `@alinea/dashboard/dev/${alineaDev ? 'Dev' : 'Lib'}Entry`
  const app = router(
    matcher.get('/~dev').map((): Response => {
      const stream = new ReadableStream({
        start(controller) {
          clients.push({
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
    //router.compress(
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
    browserBuild({
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
      ...options.buildOptions,
      ...buildOptions,
      plugins: buildOptions.plugins!.concat(
        options.buildOptions?.plugins || []
      ),
      define: {
        'process.env.NODE_ENV': production ? "'production'" : "'development'"
      },
      watch: alineaDev
        ? {
            onRebuild(error, result) {
              if (!error) reload('reload')
            }
          }
        : undefined,
      tsconfig: path.join(staticDir, 'tsconfig.json'),
      logLevel: 'error'
    }),
    matcher.get('/config.css').map((): Response => {
      return new Response('', {headers: {'content-type': 'text/css'}})
    })
    //)
  )

  setHandler!(nodeHandler(app.handle))
}
