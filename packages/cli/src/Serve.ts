import {Backend} from '@alinea/backend/Backend'
import {nodeHandler} from '@alinea/backend/router/NodeHandler'
import {router} from '@alinea/backend/router/Router'
import {ReadableStream, Request, Response, TextEncoderStream} from '@alinea/iso'
import semver from 'compare-versions'
import esbuild, {BuildOptions, BuildResult} from 'esbuild'
import http from 'node:http'
import {createRequire} from 'node:module'
import path from 'node:path'
import {buildOptions} from './build/BuildOptions'
import {generate} from './Generate'
import {DevBackend} from './serve/DevBackend'
import {dirname} from './util/Dirname'

const __dirname = dirname(import.meta)
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

export type ServeOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  port?: number
  buildOptions?: BuildOptions
  alineaDev?: boolean
  production?: boolean
}

type Client = {
  write(value: string): void
  close(): void
}

export async function serve(options: ServeOptions): Promise<void> {
  const {
    cwd = process.cwd(),
    staticDir = path.join(__dirname, 'static'),
    alineaDev = false,
    production = false
  } = options
  const port = options.port ? Number(options.port) : 4500
  const outDir = path.join(cwd, '.alinea')
  const storeLocation = path.join(outDir, 'store.js')
  const genConfigFile = path.join(outDir, 'config.js')
  const backendFile = path.join(outDir, 'backend.js')
  const draftsFile = path.join(outDir, 'drafts.js')
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

  let server: Promise<Backend> | undefined

  async function reloadServer(error?: Error) {
    await (server = error ? undefined : devServer())
  }

  await generate({
    ...options,
    onConfigRebuild: async error => {
      await reloadServer(error)
      if (!alineaDev) reload('refresh')
    },
    onCacheRebuild: async error => {
      await reloadServer(error)
      reload('refetch')
    }
  })

  server = devServer()

  let frontend: Promise<BuildResult> = esbuild.build(
    Object.assign(browserBuild(), {
      write: false,
      incremental: true,
      outdir: '/'
    })
  )
  let frontendBuilt = Date.now()

  async function serveStatic(request: Request): Promise<Response> {
    let result = await frontend
    const isResultStale = Date.now() - frontendBuilt > 1000
    if (isResultStale) {
      frontend = result.rebuild!()
      frontendBuilt = Date.now()
      result = await frontend
    }
    const url = new URL(request.url)
    const file = result.outputFiles!.find(file => {
      // Todo: check with windows sep
      return file.path.endsWith(url.pathname)
    })
    if (!file) return new Response('Not found', {status: 404})
    const extension = path.extname(file.path)
    return new Response(file.contents, {
      headers: {
        'content-type': mimeTypes.get(extension) || 'application/octet-stream'
      }
    })
  }

  const matcher = router.matcher()
  const app = router(
    matcher.get('/~dev').map(() => {
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
    matcher.get('/').map(() => {
      return new Response(
        `<!DOCTYPE html>
          <meta charset="utf-8" />
          <link rel="icon" href="data:," />
          <link href="./config.css" rel="stylesheet" />
          <link href="./entry.css" rel="stylesheet" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <body>
            <script type="module" src="./entry.js"></script>
          </body>`,
        {
          headers: {'content-type': 'text/html'}
        }
      )
    }),
    matcher.all('/hub/*').map(({request}) => {
      const unavailable = () =>
        new Response('An error occured, see your terminal for details', {
          status: 503
        })
      if (server)
        return server.then(server => server.handle(request), unavailable)
      return unavailable()
    }),
    serveStatic
  )

  function browserBuild(): BuildOptions {
    const entry = `@alinea/dashboard/dev/${alineaDev ? 'Dev' : 'Lib'}Entry`
    return {
      ignoreAnnotations: alineaDev,
      format: 'esm',
      target: 'esnext',
      treeShaking: true,
      minify: true,
      splitting: true,
      sourcemap: true,
      outdir: path.join(staticDir, 'dev'),
      bundle: true,
      absWorkingDir: cwd,
      entryPoints: {
        config: '@alinea/content/config.js',
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
      }
    }
  }

  if (alineaDev) {
    await esbuild.build({
      ...browserBuild(),
      write: false,
      logLevel: 'silent',
      watch: {
        onRebuild(error, result) {
          if (!error) reload('reload')
        }
      }
    })
  }

  http.createServer(nodeHandler(app.handle)).listen(port, () => {
    console.log(
      `> Alinea ${
        production ? '(production) ' : ''
      }dashboard available on http://localhost:${port}`
    )
  })

  async function devServer() {
    const unique = Date.now()
    const {createStore: createDraftStore} = await import(`file://${draftsFile}`)
    let backend
    if (production) {
      backend = (await import(`file://${backendFile}`)).backend
    } else {
      // Todo: these should be imported in a worker since we can't reclaim memory
      // used, see #nodejs/modules#307
      const {config} = await import(`file://${genConfigFile}?${unique}`)
      const {createStore} = await import(`file://${storeLocation}?${unique}`)
      backend = new DevBackend({
        config,
        createStore,
        port,
        cwd,
        createDraftStore
      })
    }
    return backend
  }
}
