import {DevServer, Server} from '@alinea/backend'
import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import semver from 'compare-versions'
import compression from 'compression'
import {dirname} from 'dirname-filename-esm'
import esbuild, {BuildOptions, Plugin} from 'esbuild'
import express from 'express'
import {createServer, ServerResponse} from 'node:http'
import {createRequire} from 'node:module'
import path from 'node:path'
import serveHandler from 'serve-handler'
import {generate} from './Generate'

const require = createRequire(import.meta.url)

const __dirname = dirname(import.meta)

export type ServeOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  port?: number
  buildOptions?: BuildOptions
}

export async function serve(options: ServeOptions) {
  const {
    cwd = process.cwd(),
    buildOptions,
    staticDir = path.join(__dirname, 'static')
  } = options
  const port = options.port || 4500
  const outDir = path.join(cwd, '.alinea')
  const storeLocation = path.join(outDir, 'store.js')
  const genConfigFile = path.join(outDir, 'config.js')
  const {version} = require('react/package.json')
  const isReact18 = semver.compare(version, '18.0.0', '>=')
  const clients: Array<ServerResponse> = []
  let banner = ''
  const reloadServer = createServer((req, res) => {
    clients.push(
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        Connection: 'keep-alive'
      })
    )
  })

  function reload() {
    for (const res of clients) res.write('data: update\n\n')
    clients.length = 0
  }

  await new Promise<void>(resolve => {
    reloadServer.listen(0, function () {
      const info = reloadServer.address()
      if (info && typeof info === 'object')
        banner = `(() => {if(typeof EventSource !== 'undefined') new EventSource('http://127.0.0.1:${info.port}').onmessage = () => location.reload()})();`
      resolve()
    })
  })

  const reloadPlugin: Plugin = {
    name: 'reload',
    setup(build) {
      build.onEnd(reload)
      build.initialOptions.banner = {js: banner}
    }
  }

  let build: Promise<{server: Server; stop: () => void}> | undefined

  const app = express()
  app.use((req, res, next) => {
    const unavailable = () =>
      res.status(503).end('An error occured, see your terminal for details')
    if (build) build.then(({server}) => server.app(req, res, next), unavailable)
    else unavailable()
  })
  app.use(compression())
  app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
    <meta charset="utf-8" />
    <title>Alinea</title>
    <link href="./stdin.css" rel="stylesheet" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <body>
      <script type="module" src="./stdin.js"></script>
    </body>
  `)
  })
  app.use((req, res) =>
    serveHandler(req, res, {public: path.join(staticDir, 'serve')})
  )

  await generate({
    ...options,
    watch: {
      async onRebuild(error, result) {
        if (build) (await build).stop()
        await (build = error ? undefined : startServer())
        reload()
      }
    }
  })

  build = startServer()

  app.listen(port)
  console.log(`> Alinea dashboard available on http://localhost:${port}`)

  async function startServer() {
    const unique = Date.now()
    // Todo: these should be imported in a worker since we can't reclaim memory
    // used, see #nodejs/modules#307
    const {config} = await import(`file://${genConfigFile}?${unique}`)
    const {createStore} = await import(`file://${storeLocation}?${unique}`)
    const entryPoint = isReact18 ? 'react18' : 'react'
    const entry = `
      import '@alinea/css'
      import {Client} from '@alinea/client'
      import {renderDashboard} from '@alinea/dashboard/render/${entryPoint}'
      import {config} from ${JSON.stringify(genConfigFile)}
      renderDashboard({
        config,
        client: new Client(config, 'http://localhost:${port}')
      })
    `
    const result = await esbuild.build({
      format: 'esm',
      target: 'esnext',
      treeShaking: true,
      minify: true,
      splitting: true,
      sourcemap: true,
      outdir: path.join(staticDir, 'serve'),
      bundle: true,
      watch: true,
      stdin: {
        contents: entry,
        resolveDir: cwd
      },
      platform: 'browser',
      ...buildOptions,
      plugins: [
        reloadPlugin,
        EvalPlugin,
        ReactPlugin,
        ...(buildOptions?.plugins || [])
      ],
      define: {
        'process.env.NODE_ENV': "'development'"
      },
      loader: {
        ...buildOptions?.loader,
        '.woff': 'file',
        '.woff2': 'file'
      }
    })
    return {
      server: new DevServer({
        config,
        createStore,
        port,
        cwd
      }),
      stop: result.stop!
    }
  }
}
