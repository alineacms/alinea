import type {LocalConnection} from './src/core/Connection.js'
import {localUser} from './src/core/User.js'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from './src/dashboard/App.js'
import {views} from './src/dashboard/app/field/views.js'
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
  revisions() {
    return Promise.resolve([])
  },
  revisionData() {
    return Promise.resolve(undefined)
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

const app = (
  <StrictMode>
    <App
      graph={db}
      events={db.index}
      config={cms.config}
      client={fixtureConnection}
      views={views}
      alineaDev
    />
  </StrictMode>
)

createRoot(elem).render(app)
