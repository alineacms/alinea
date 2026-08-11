import type {LocalConnection, Revision} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import type {User} from '#/core/User.js'
import {App} from '#/dashboard/App.js'
import {Config, Field} from '#/index.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {views} from '#/field/views.js'
import {use, useState} from 'react'
import {
  dashboardLinkScenarioIds,
  dashboardScenarioIds
} from './DashboardScenarioData.js'

const ScenarioPage = Config.document('Page', {
  contains: ['Page'],
  fields: {
    title: Field.text('Title'),
    body: Field.richText('Body', {searchable: true}),
    relatedPage: Field.entry('Related page', {
      async location({entry, graph}) {
        const folder = await graph.get({
          id: dashboardLinkScenarioIds.referenceFolder,
          workspace: entry.workspace === 'main' ? 'references' : 'main'
        })
        return {
          workspace: folder._workspace,
          root: folder._root,
          parentId: folder._id
        }
      }
    })
  }
})

const HiddenFolder = Config.document('Hidden folder', {
  contains: ['HiddenFolder'],
  defaultView: 'overview',
  fields: {},
  hidden: true
})

const main = Config.workspace('Main', {
  source: 'main',
  roots: {
    pages: Config.root('Pages', {contains: ['Page', 'HiddenFolder']}),
    media: Config.media({i18n: {locales: ['en', 'fr']}})
  }
})

const references = Config.workspace('References', {
  source: 'references',
  roots: {
    library: Config.root('Reference library', {contains: ['Page']})
  }
})

const config = Config.create({
  enableDrafts: true,
  schema: {HiddenFolder, Page: ScenarioPage},
  workspaces: {main, references}
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
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Alpha'}
  })
  await db.create({
    id: dashboardScenarioIds.beta,
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Beta'}
  })
  await db.create({
    id: dashboardScenarioIds.folder,
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Folder'}
  })
  await db.create({
    id: dashboardScenarioIds.child,
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    parentId: dashboardScenarioIds.folder,
    set: {title: 'Child'}
  })
  await db.create({
    id: dashboardScenarioIds.otherFolder,
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Other folder'}
  })
  await db.create({
    id: dashboardScenarioIds.otherChild,
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    parentId: dashboardScenarioIds.otherFolder,
    set: {title: 'Other child'}
  })
  await db.create({
    id: dashboardScenarioIds.hiddenFolder,
    type: HiddenFolder,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Hidden folder'}
  })
  await db.create({
    id: dashboardScenarioIds.hiddenChild,
    type: HiddenFolder,
    workspace: 'main',
    root: 'pages',
    parentId: dashboardScenarioIds.hiddenFolder,
    set: {title: 'Hidden child'}
  })
  await db.create({
    id: dashboardScenarioIds.searchPartial,
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Receiver archive for wireless systems'}
  })
  // Keep the body match before the title match so index order conflicts with
  // search relevance.
  await db.create({
    id: dashboardScenarioIds.searchBody,
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    set: {
      title: 'Archive',
      body: [
        {
          _type: 'paragraph',
          content: [
            {
              _type: 'text',
              text: 'A wireless receiver at 77 GHz is described here.'
            }
          ]
        }
      ]
    }
  })
  await db.create({
    id: dashboardScenarioIds.searchTitle,
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Wireless receiver at 77 GHz'}
  })
  await db.mutate([
    {
      op: 'create',
      id: dashboardScenarioIds.mediaFile,
      type: 'MediaFile',
      locale: null,
      workspace: 'main',
      root: 'media',
      data: {
        title: 'Legacy image',
        path: 'legacy-image',
        location: 'legacy-image.jpg',
        extension: '.jpg',
        size: 1024,
        hash: 'legacy-image',
        alt: null
      }
    }
  ])
  await db.create({
    id: dashboardLinkScenarioIds.referenceFolder,
    type: ScenarioPage,
    workspace: 'references',
    root: 'library',
    set: {title: 'Reference folder'}
  })
  await db.create({
    id: dashboardLinkScenarioIds.referenceTarget,
    type: ScenarioPage,
    workspace: 'references',
    root: 'library',
    parentId: dashboardLinkScenarioIds.referenceFolder,
    set: {title: 'Reference target'}
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
