import {JsonLoader, JWTPreviews, Server} from '@alinea/backend'
import {FileData} from '@alinea/backend/data/FileData'
import {FileDrafts} from '@alinea/backend/drafts/FileDrafts'
import compression from 'compression'
import express from 'express'
import {existsSync} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import {generate} from './Generate'

export type ServeOptions = {
  cwd?: string
  configFile?: string
  port?: number
}

export async function serve(options: ServeOptions) {
  const {cwd = process.cwd(), configFile = 'alinea.config'} = options
  const port = options.port || 4500
  const dashboardUrl = `http://localhost:${port}`
  const outDir = path.join(cwd, '.alinea')
  const storeLocation = path.join(outDir, 'store.js')
  const configLocation = path.join(outDir, 'config.js')
  if (!existsSync(storeLocation)) await generate(options)
  const {createStore} = await import('file://' + storeLocation)
  const {config} = await import('file://' + configLocation)
  const data = new FileData({
    config,
    fs,
    loader: JsonLoader,
    rootDir: cwd
  })
  const drafts = new FileDrafts({
    fs,
    dir: path.join(outDir, '_tmp/drafts')
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
  const app = express()
  app.use(server.app)
  app.use(compression())
  // Todo: use a cdn to bundle the dashboard or use esbuild serve/watch here?
  /*app.use((req, res) => {
    res.end(`
      <!doctype html>
      <meta charset="utf-8" />
      <link href="./static/client.css" rel="stylesheet" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <body>
        <script type="module">
        import {Client} from '@alinea/client'
        import '@alinea/css/global.css'
        import {renderDashboard} from '@alinea/dashboard'
        import {config} from '../../website/.alinea/config'
        renderDashboard({
          config,
          client: new Client(config, 'http://localhost:4500')
        })
        </script>
      </body>
    `)
  })*/
}
