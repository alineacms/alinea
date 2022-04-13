import {JsonLoader, JWTPreviews, Server} from '@alinea/backend'
import {FileData} from '@alinea/backend/data/FileData'
import {FileDrafts} from '@alinea/backend/drafts/FileDrafts'
import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import compression from 'compression'
import {dirname} from 'dirname-filename-esm'
import esbuild, {BuildOptions} from 'esbuild'
import express, {RequestHandler} from 'express'
import {existsSync} from 'node:fs'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import {generate} from './Generate'

const __dirname = dirname(import.meta)

export type ServeOptions = {
  cwd?: string
  configFile?: string
  port?: number
  previewHandler?: (server: Server) => RequestHandler
  buildOptions?: BuildOptions
}

export async function serve(options: ServeOptions) {
  const {cwd = process.cwd(), previewHandler, buildOptions} = options
  const port = options.port || 4500
  const dashboardUrl = `http://localhost:${port}`
  const outDir = path.join(cwd, '.alinea')
  const storeLocation = path.join(outDir, 'store.js')
  const genConfigFile = path.join(outDir, 'config.js')
  if (!existsSync(storeLocation)) await generate(options)
  const {createStore} = await import('file://' + storeLocation)
  const {config} = await import('file://' + genConfigFile)
  const data = new FileData({
    config,
    fs,
    loader: JsonLoader,
    rootDir: cwd
  })
  const drafts = new FileDrafts({
    fs,
    dir: path.join(outDir, '.drafts')
  })
  const server = new Server({
    dashboardUrl,
    createStore,
    config,
    drafts: drafts,
    media: data,
    target: data,
    previews: new JWTPreviews('local')
  })
  const entry = `
    import '@alinea/css'
    import {Client} from '@alinea/client'
    import {renderDashboard} from '@alinea/dashboard'
    import {config} from ${JSON.stringify(genConfigFile)}
    renderDashboard({
      config,
      client: new Client(config, 'http://localhost:${port}')
    })
  `
  console.log(__dirname)
  const esbuildServer = await esbuild.serve(
    {
      servedir: path.join(__dirname, 'static/serve')
    },
    {
      format: 'esm',
      target: 'esnext',
      treeShaking: true,
      minify: true,
      sourcemap: true,
      outfile: path.join(__dirname, 'static/serve/dashboard.js'),
      bundle: true,
      stdin: {
        contents: entry,
        resolveDir: cwd,
        sourcefile: 'dashboard.js'
      },
      platform: 'browser',
      ...buildOptions,
      plugins: [EvalPlugin, ReactPlugin, ...(buildOptions?.plugins || [])],
      loader: {
        ...buildOptions?.loader,
        '.woff': 'file',
        '.woff2': 'file',
        '.json': 'json'
      }
    }
  )

  const app = express()
  app.use(server.app)
  app.use(compression())
  if (previewHandler) app.get('/api/preview', previewHandler(server))
  app.use((req, res) => {
    const options = {
      hostname: esbuildServer.host,
      port: esbuildServer.port,
      path: req.url,
      method: req.method,
      headers: req.headers
    }

    const proxyReq = http.request(options, proxyRes => {
      if (proxyRes.statusCode === 404) {
        res.writeHead(404, {'Content-Type': 'text/plain'})
        res.end('404: Not Found')
      } else {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
        proxyRes.pipe(res, {end: true})
      }
    })

    req.pipe(proxyReq, {end: true})
  })

  app.listen(port)

  console.log(`> Alinea dashboard available on http://localhost:${port}`)
}
