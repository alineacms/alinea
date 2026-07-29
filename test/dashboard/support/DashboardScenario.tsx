import type {LocalConnection, Revision} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import type {User} from '#/core/User.js'
import {App} from '#/dashboard/App.js'
import {Config} from '#/index.js'
import {DashboardTestPage} from '#test/DashboardFixture.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {views} from '#/field/views.js'
import {use, useState} from 'react'
import {dashboardScenarioIds} from './DashboardScenarioData.js'

const main = Config.workspace('Main', {
  source: '.',
  roots: {
    pages: Config.root('Pages', {contains: ['Page']})
  }
})

const config = Config.create({
  enableDrafts: true,
  schema: {Page: DashboardTestPage},
  workspaces: {main}
})

interface DashboardScenarioState {
  client: LocalConnection
  db: LocalDB
}

const users: Array<User> = [
  {
    sub: 'local',
    name: 'Local user',
    email: 'local@example.com',
    roles: ['admin']
  },
  {
    sub: 'alice',
    name: 'Alice Editor',
    email: 'alice@example.com',
    roles: []
  }
]

async function createDashboardScenario(): Promise<DashboardScenarioState> {
  const db = new LocalDB(config)
  await db.sync()
  await db.create({
    id: dashboardScenarioIds.alpha,
    type: DashboardTestPage,
    set: {title: 'Alpha'}
  })
  await db.create({
    id: dashboardScenarioIds.beta,
    type: DashboardTestPage,
    set: {title: 'Beta'}
  })
  await db.create({
    id: dashboardScenarioIds.folder,
    type: DashboardTestPage,
    set: {title: 'Folder'}
  })
  await db.create({
    id: dashboardScenarioIds.child,
    type: DashboardTestPage,
    parentId: dashboardScenarioIds.folder,
    set: {title: 'Child'}
  })
  const baseClient = createTestConnection(db, {users})
  const client: LocalConnection = {
    ...baseClient,
    revisions(file) {
      return Promise.resolve([
        revision('current', file, 'Current version', 'Local user'),
        revision('historical', file, 'Page published', 'Alice Historian')
      ])
    },
    revisionData(_file, revisionId) {
      if (revisionId !== 'historical') return Promise.resolve(undefined)
      return Promise.resolve({
        _id: dashboardScenarioIds.alpha,
        _type: 'Page',
        _index: 'a0',
        _root: 'pages',
        title: 'Historical Alpha'
      } satisfies EntryRecord)
    }
  }
  return {client, db}
}

export function DashboardScenario() {
  const [scenario] = useState(createDashboardScenario)
  const {client, db} = use(scenario)
  return (
    <App
      graph={db}
      events={db.index}
      config={config}
      client={client}
      views={views}
      local
    />
  )
}

function revision(
  ref: string,
  file: string,
  description: string,
  name: string
): Revision {
  return {
    ref,
    file,
    description,
    createdAt: Date.UTC(2025, 0, ref === 'current' ? 2 : 1, 12),
    user: {
      name,
      email: `${name.toLowerCase().replaceAll(' ', '.')}@example.com`
    }
  }
}
