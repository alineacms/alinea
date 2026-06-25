import {BasicAuth} from '#/backend/api/BasicAuth.js'
import {createRemote} from '#/backend/api/CreateBackend.js'
import {DatabaseApi} from '#/backend/api/DatabaseApi.js'
import {createHandler} from '#/backend/Handler.js'
import {fromNodeRequest, respondTo} from '#/backend/router/NodeHandler.js'
import {DevDB} from '#/cli/generate/DevDB.js'
import {GitHistory} from '#/cli/serve/GitHistory.js'
import type {RequestContext} from '#/core/Connection.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import type {User} from '#/core/User.js'
import {cms} from '#/dashboard/fixture/cms.js'
import {Database as BunSqlite} from 'bun:sqlite'
import path from 'node:path'
import * as driver from 'rado/driver'
import react from '@vitejs/plugin-react'
import {createServer} from 'vite'

const rootDir = process.cwd()
const fixtureDir = path.join(rootDir, 'src/dashboard/fixture')
const contentDir = path.join(fixtureDir, 'content')
const port = Number(process.env.PORT ?? 4600)

function userForCredentials(username: string, password: string): User | false {
  if (password !== 'password') return false
  return {
    sub: username,
    email: `${username}@example.com`,
    name: username,
    roles: [username]
  }
}

function requestContext(request: Request): RequestContext {
  return {
    isDev: true,
    handlerUrl: new URL('/api', request.url),
    apiKey: 'self-hosted-dev'
  }
}

const local = new DevDB({
  config: cms.config,
  rootDir: fixtureDir,
  dashboardUrl: `http://localhost:${port}`
})
await local.sync()

const sqlite = new BunSqlite(':memory:')
const db = driver['bun:sqlite'](sqlite)
await seedSampleUsers()
const history = new GitHistory(cms.config, fixtureDir)
const handleApi = createHandler({
  cms,
  db: local,
  remote(context) {
    const auth = new BasicAuth(context, userForCredentials)
    const database = new DatabaseApi(context, {db})
    return createRemote(auth, local, database, history)
  }
})

const vite = await createServer({
  root: path.join(rootDir, 'test/self-hosted'),
  appType: 'spa',
  clearScreen: false,
  define: {
    'process.env.ALINEA_BUILD_ID': JSON.stringify('self-hosted-dev'),
    'process.env.NODE_ENV': JSON.stringify('development')
  },
  plugins: [
    react(),
    {
      name: 'alinea-self-hosted-api',
      configureServer(server) {
        server.middlewares.use('/api', async (incoming, outgoing) => {
          try {
            const request = fromNodeRequest(incoming)
            const response = await handleApi(request, requestContext(request))
            await respondTo(outgoing, response)
          } catch (error) {
            console.error(error)
            outgoing.statusCode = 500
            outgoing.end('Internal server error')
          }
        })
      }
    }
  ],
  server: {
    host: 'localhost',
    port,
    strictPort: false
  },
  resolve: {
    alias: {
      '#': path.join(rootDir, 'src'),
      alinea: path.join(rootDir, 'src')
    }
  }
})

const server = await vite.listen()
const address = server.httpServer?.address()
const actualPort = typeof address === 'object' && address ? address.port : port

console.log(`Self-hosted dashboard: http://localhost:${actualPort}/`)
console.log(`Content source: ${contentDir}`)

async function seedSampleUsers(): Promise<void> {
  const database = new DatabaseApi(requestContext(new Request('http://localhost/api')), {
    db
  })
  await database.createUser({
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    roles: ['admin']
  })
  await database.createUser({
    email: 'grace@example.com',
    name: 'Grace Hopper',
    roles: ['editor']
  })
  await database.createUser({
    email: 'linus@example.com',
    name: 'Linus Torvalds',
    roles: ['viewer']
  })
}
