import {DevServer, Server} from '@alinea/backend'
import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import semver from 'compare-versions'
import compression from 'compression'
import {dirname} from 'dirname-filename-esm'
import esbuild, {BuildOptions} from 'esbuild'
import express from 'express'
import http, {ServerResponse} from 'node:http'
import {createRequire} from 'node:module'
import path from 'node:path'
import serveHandler from 'serve-handler'
import {generate} from './Generate'

const __dirname = dirname(import.meta)
const require = createRequire(import.meta.url)

export type ServeOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  port?: number
  buildOptions?: BuildOptions
  dev?: boolean
}

export async function serve(options: ServeOptions) {
  const {
    cwd = process.cwd(),
    buildOptions,
    staticDir = path.join(__dirname, 'static'),
    dev = false
  } = options
  const port = options.port || 4500
  const outDir = path.join(cwd, '.alinea')
  const storeLocation = path.join(outDir, 'store.js')
  const genConfigFile = path.join(outDir, 'config.js')
  const clients: Array<ServerResponse> = []
  const {version} = require('react/package.json')
  const isReact18 = semver.compare(version, '18.0.0', '>=')
  const react = isReact18 ? 'react18' : 'react'

  function reload(type: 'refetch' | 'refresh' | 'reload') {
    for (const res of clients) res.write(`data: ${type}\n\n`)
    if (type === 'reload') clients.length = 0
  }

  let server: Promise<Server> | undefined

  async function reloadServer(error?: Error) {
    await (server = error ? undefined : devServer())
  }

  await generate({
    ...options,
    onConfigRebuild: async error => {
      await reloadServer(error)
      if (!dev) reload('refresh')
    },
    onCacheRebuild: async error => {
      await reloadServer(error)
      reload('refetch')
    }
  })

  server = devServer()

  const app = express()
  app.use('/~dev', (req, res) => {
    clients.push(
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        Connection: 'keep-alive'
      })
    )
  })
  app.use((req, res, next) => {
    const unavailable = () =>
      res.status(503).end('An error occured, see your terminal for details')
    if (server) server.then(server => server.app(req, res, next), unavailable)
    else unavailable()
  })
  app.use(compression())
  app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
    <meta charset="utf-8" />
    <title>Alinea</title>
    <link href="./config.css" rel="stylesheet" />
    <link href="./entry.css" rel="stylesheet" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <body>
      <script type="module" src="./entry.js"></script>
    </body>`)
  })

  const entry = `@alinea/dashboard/dev/${dev ? 'Dev' : 'Lib'}Entry`

  function browserBuild(): BuildOptions {
    return {
      ignoreAnnotations: dev,
      format: 'esm',
      target: 'esnext',
      treeShaking: true,
      // minify: true,
      splitting: true,
      sourcemap: true,
      outdir: path.join(staticDir, 'dev'),
      bundle: true,
      absWorkingDir: cwd,
      entryPoints: {
        config: '@alinea/content/config.js',
        entry
      },
      inject: [path.join(staticDir, `dev/render-${react}.js`)],
      platform: 'browser',
      ...buildOptions,
      plugins: [EvalPlugin, ReactPlugin, ...(buildOptions?.plugins || [])],
      define: {
        'process.env.NODE_ENV': "'development'"
      },
      loader: {
        ...buildOptions?.loader,
        '.woff': 'file',
        '.woff2': 'file'
      }
    }
  }

  try {
    const staticServer = await esbuild.serve(
      {servedir: path.join(staticDir, 'dev')},
      browserBuild()
    )
    app.use((req, res) => {
      const options = {
        hostname: staticServer.host,
        port: staticServer.port,
        path: req.url,
        method: req.method,
        headers: req.headers
      }
      const proxyReq = http.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode!, proxyRes.headers)
        proxyRes.pipe(res, {end: true})
      })
      req.pipe(proxyReq, {end: true})
    })
  } catch (e: any) {
    if (e.message.includes('not supported')) {
      await esbuild.build({...browserBuild(), watch: true})
      app.use((req, res) =>
        serveHandler(req, res, {public: path.join(staticDir, 'dev')})
      )
    } else {
      process.exit(1)
    }
  }

  if (dev) {
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
  app.listen(port)
  console.log(`> Alinea dashboard available on http://localhost:${port}`)

  async function devServer() {
    const unique = Date.now()
    // Todo: these should be imported in a worker since we can't reclaim memory
    // used, see #nodejs/modules#307
    const {config} = await import(`file://${genConfigFile}?${unique}`)
    const {createStore} = await import(`file://${storeLocation}?${unique}`)
    return new DevServer({
      config,
      createStore,
      port,
      cwd
    })
  }
}
