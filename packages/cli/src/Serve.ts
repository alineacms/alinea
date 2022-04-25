import {DevServer} from '@alinea/backend'
import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import {ReloadPlugin} from '@esbx/reload'
import compression from 'compression'
import {dirname} from 'dirname-filename-esm'
import esbuild, {BuildOptions} from 'esbuild'
import express from 'express'
import path from 'node:path'
import serveHandler from 'serve-handler'
import {generate} from './Generate'

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
  await generate({...options, watch: true})
  const {createStore} = await import('file://' + storeLocation)
  const {config} = await import('file://' + genConfigFile)

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

  await esbuild.build({
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
      ReloadPlugin,
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
      '.woff2': 'file',
      '.json': 'json'
    }
  })

  const server = new DevServer({
    config,
    createStore,
    port,
    cwd
  })
  const app = express()
  app.use(server.app)
  app.use(compression())
  app.use((req, res) =>
    serveHandler(req, res, {public: path.join(staticDir, 'serve')})
  )
  app.listen(port)

  console.log(`> Alinea dashboard available on http://localhost:${port}`)
}
