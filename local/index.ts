import {createHandler} from 'alinea/backend/Handler'
import {createRemote} from 'alinea/backend/api/CreateBackend'
import {DevDB} from 'alinea/cli/generate/DevDB'
import {GitHistory} from 'alinea/cli/serve/GitHistory'
import {LocalAuth} from 'alinea/cli/serve/LocalAuth'
import {MemoryDrafts} from 'alinea/cli/serve/MemoryDrafts'
import {localUser} from 'alinea/core/User'
import {serve} from 'bun'
import {cms} from '../apps/dev/src/cms.tsx'
import index from './index.html'

const context = {
  isDev: true,
  handlerUrl: new URL('http://localhost/api'),
  apiKey: process.env.ALINEA_API_KEY ?? 'dev'
}
const user = Promise.resolve(localUser)
const auth = new LocalAuth(context, user)
const rootDir = './apps/dev'
const db = new DevDB({
  config: cms.config,
  rootDir,
  dashboardUrl: 'http://localhost'
})
const history = new GitHistory(cms.config, rootDir)
const drafts = new MemoryDrafts()
const remote = () => createRemote(auth, db, drafts, history)
const handleApi = createHandler({
  cms,
  remote,
  db
})

const server = serve({
  routes: {
    '/': index,
    '/api': request => {
      return handleApi(request, context)
    }
  },
  development: true
})

console.log(`Server running at http://localhost:${server.port}`)
