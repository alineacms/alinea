import {views} from '#/field/views.js'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import type {LocalConnection} from './src/core/Connection.js'
import {MemorySource} from './src/core/source/MemorySource.js'
import {localUser} from './src/core/User.js'
import {App} from './src/dashboard/App.js'
import {DashboardWorker} from './src/dashboard/boot/DashboardWorker.js'
import {WorkerDB} from './src/dashboard/boot/WorkerDB.js'
import {cms, db} from './src/dashboard/fixture/cms.ts?alinea'

const elem = document.getElementById('root')!
const fixtureConnection: LocalConnection = {
  mutate(mutations) {
    return db.mutate(mutations)
  },
  previewToken() {
    return Promise.resolve('dev-preview-token')
  },
  resolve(query) {
    return db.resolve(query)
  },
  user() {
    return Promise.resolve(localUser)
  },
  write(request) {
    return db.write(request)
  },
  getTreeIfDifferent(sha) {
    return db.getTreeIfDifferent(sha)
  },
  getBlobs(shas) {
    return db.getBlobs(shas)
  },
  revisions(file) {
    return db.revisions(file)
  },
  revisionData(file, revisionId) {
    return db.revisionData(file, revisionId)
  },
  getDraft() {
    return Promise.resolve(undefined)
  },
  storeDraft() {
    return Promise.resolve()
  },
  prepareUpload(file) {
    return db.prepareUpload(file)
  }
}

const sourceMutate = db.mutate.bind(db)

db.mutate = async (...args) => {
  console.log('Mutate called with', args)
  return sourceMutate(...args)
}

const worker = new DashboardWorker(new MemorySource())
await worker.load('frontend-fixture', cms.config, fixtureConnection)
const graph = new WorkerDB(cms.config, worker, fixtureConnection, worker)

const app = (
  <StrictMode>
    <App
      graph={graph}
      events={worker}
      config={cms.config}
      client={fixtureConnection}
      views={views}
      alineaDev
    />
  </StrictMode>
)

createRoot(elem).render(app)
