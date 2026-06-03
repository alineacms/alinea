import type {LocalConnection} from '#/core/Connection.js'
import {localUser} from '#/core/User.js'
import {views} from '#/field/views.js'
import {App} from './App.js'
import {cms, db} from './fixture/cms.ts?alinea'

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

export function DashboardFixture() {
  return (
    <div style={{height: '100vh'}}>
      <App
        graph={db}
        events={db.index}
        config={cms.config}
        client={fixtureConnection}
        views={views}
        local
      />
    </div>
  )
}

export default {
  title: 'Dashboard'
}
