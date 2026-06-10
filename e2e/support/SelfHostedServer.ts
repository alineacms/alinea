import {createBackend, createRemote} from '#/backend/api/CreateBackend.js'
import {createHandler} from '#/backend/Handler.js'
import {buildOptions} from '#/cli/build/BuildOptions.js'
import {createDevServer, type DevServer} from '#/cli/serve/DevServer.js'
import {startServer, type Server} from '#/cli/serve/StartServer.js'
import {Database} from 'bun:sqlite'
import type {Plugin} from 'esbuild'
import path from 'node:path'

export interface SelfHostedServer {
  url: string
  close(): Promise<void>
}

export interface StartSelfHostedServerOptions {
  rootDir: string
  configFile: string
  port?: number
}

export async function startSelfHostedServer({
  rootDir,
  configFile,
  port = 4600
}: StartSelfHostedServerOptions): Promise<SelfHostedServer> {
  const nodeServer = await startServer(port, 0, true)
  const url = `http://localhost:${nodeServer.port}`
  const sqlite = new Database(':memory:')
  const abortController = new AbortController()
  const devServer = await createDevServer(rootDir, {
    cmd: 'build',
    configFile,
    dashboardUrl: Promise.resolve(url),
    forceAuth: true,
    production: true,
    buildOptions: {
      ...buildOptions,
      minify: false,
      plugins: (buildOptions.plugins || []).concat(sourceModeBrowserPlugin())
    },
    handler({cms, db, drafts}) {
      const backend = createBackend(cms.config, {
        auth(username, password) {
          if (username !== 'admin' || password !== 'password') return false
          return {
            sub: 'e2e-admin',
            name: 'E2E admin',
            roles: ['admin']
          }
        },
        database: {
          driver: 'bun:sqlite',
          client: sqlite
        },
        github: {
          owner: 'unused',
          repo: 'unused',
          branch: 'main',
          authToken: 'unused',
          rootDir: '',
          contentDir: ''
        }
      })
      return createHandler({
        cms,
        db,
        remote(context) {
          return createRemote(backend(context), drafts, {
            write(request) {
              return db.write(request)
            },
            getTreeIfDifferent(sha) {
              return db.getTreeIfDifferent(sha)
            },
            getBlobs(shas) {
              return db.getBlobs(shas)
            },
            async revisions() {
              return []
            },
            async revisionData() {
              return undefined
            }
          })
        }
      })
    }
  })
  const loop = serveRequests(nodeServer, devServer, abortController)

  return {
    url,
    async close() {
      abortController.abort()
      devServer.close()
      nodeServer.close()
      sqlite.close()
      await loop
    }
  }
}

function sourceModeBrowserPlugin(): Plugin {
  return {
    name: 'source-mode-browser',
    setup(build) {
      build.onResolve({filter: /^alinea\/css$/}, () => {
        return {path: path.resolve('src/theme.css')}
      })
      build.onResolve(
        {filter: /^#\/core\/media\/CreatePreview\.js$/},
        () => {
          return {
            path: path.resolve('src/core/media/CreatePreview.browser.ts')
          }
        }
      )
    }
  }
}

async function serveRequests(
  nodeServer: Server,
  devServer: DevServer,
  abortController: AbortController
) {
  const pending = new Set<Promise<void>>()
  for await (const {request, respondWith} of nodeServer.serve(abortController)) {
    const response = devServer
      .handle(request)
      .then(respondWith)
      .finally(() => pending.delete(response))
    pending.add(response)
  }
  await Promise.allSettled(pending)
}
