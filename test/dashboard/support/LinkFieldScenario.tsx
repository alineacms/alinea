import type {LocalConnection} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {App} from '#/dashboard/App.js'
import {views} from '#/field/views.js'
import {Config, Field} from '#/index.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {use, useState} from 'react'
import {
  dashboardLinkScenarioIds as linkScenarioIds,
  dashboardScenarioIds
} from './DashboardScenarioData.js'

const ScenarioPage = Config.document('Page', {
  contains: ['Page'],
  fields: {
    title: Field.text('Title'),
    summary: Field.text('Summary', {overview: true}),
    relatedPage: Field.entry('Related page', {
      async location({entry, graph}) {
        const folder = await graph.get({
          id: linkScenarioIds.referenceFolder,
          workspace: entry.workspace === 'main' ? 'references' : 'main'
        })
        return {
          workspace: folder._workspace,
          root: folder._root,
          parentId: folder._id
        }
      }
    }),
    filteredPage: Field.entry('Filtered page', {
      location: {workspace: 'references', root: 'library'},
      async condition({entry}) {
        return {
          _id:
            entry.workspace === 'main'
              ? linkScenarioIds.referenceTarget
              : dashboardScenarioIds.alpha
        }
      }
    }),
    globalFilteredPage: Field.entry('Global filtered page', {
      condition: {_id: dashboardScenarioIds.child}
    }),
    localizedPage: Field.entry('Localized page', {
      location: {workspace: 'localized', root: 'pages'}
    }),
    childPage: Field.entry('Child page', {pickChildren: true}),
    browsePage: Field.entry('Browse page', {
      location: {workspace: 'main', root: 'pages'}
    }),
    limitedPage: Field.entry('Limited page', {
      location: {workspace: 'main', root: 'pages'},
      limitLocations: [{workspace: 'main', root: 'pages'}]
    }),
    relatedPages: Field.entry.multiple('Repeated pages', {
      location: {workspace: 'main', root: 'pages'}
    }),
    navigablePage: Field.entry('Navigable page', {
      condition: {_id: dashboardScenarioIds.child},
      enableNavigation: true
    }),
    image: Field.image('Featured image'),
    file: Field.file('Download')
  }
})

const main = Config.workspace('Main', {
  source: 'main',
  roots: {
    pages: Config.root('Pages', {contains: ['Page']}),
    media: Config.media()
  }
})

const references = Config.workspace('References', {
  source: 'references',
  roots: {
    library: Config.root('Reference library', {contains: ['Page']})
  }
})

const localized = Config.workspace('Localized', {
  source: 'localized',
  roots: {
    pages: Config.root('Localized pages', {
      contains: ['Page'],
      i18n: {locales: ['en', 'fr']}
    })
  }
})

const config = Config.create({
  enableDrafts: true,
  schema: {Page: ScenarioPage},
  workspaces: {localized, main, references}
})

interface LinkFieldScenarioState {
  client: LocalConnection
  db: LocalDB
}

async function createLinkFieldScenario(): Promise<LinkFieldScenarioState> {
  const db = new LocalDB(config)
  db.prepareUpload = file =>
    Promise.resolve({
      entryId: 'dashboard-scenario-upload',
      location: file,
      previewUrl: '',
      url: '/__dashboard-scenario-upload',
      method: 'POST'
    })
  await db.sync()
  await createPage(db, dashboardScenarioIds.alpha, 'Alpha')
  await createPage(db, dashboardScenarioIds.beta, 'Beta')
  await createPage(db, dashboardScenarioIds.folder, 'Folder')
  await createPage(
    db,
    dashboardScenarioIds.child,
    'Child',
    dashboardScenarioIds.folder
  )
  await createPage(db, 'main-i18-result', 'I18 local result')
  await db.create({
    id: linkScenarioIds.mediaDirectory,
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    set: {title: 'Media directory', path: 'media-directory'}
  })
  await db.create({
    id: linkScenarioIds.emptyMediaDirectory,
    type: MediaLibrary,
    workspace: 'main',
    root: 'media',
    set: {title: 'Empty media directory', path: 'empty-media-directory'}
  })
  await db.create({
    id: linkScenarioIds.existingImage,
    type: MediaFile,
    workspace: 'main',
    root: 'media',
    set: {
      title: 'Existing image',
      path: 'existing-image',
      location: 'existing-image.jpg',
      extension: '.jpg',
      size: 1024,
      hash: 'existing-image'
    }
  })
  await db.create({
    id: linkScenarioIds.nestedImage,
    type: MediaFile,
    workspace: 'main',
    root: 'media',
    parentId: linkScenarioIds.mediaDirectory,
    set: {
      title: 'Nested image',
      path: 'nested-image',
      location: 'nested-image.jpg',
      extension: '.jpg',
      size: 512,
      hash: 'nested-image'
    }
  })
  await db.create({
    id: linkScenarioIds.existingFile,
    type: MediaFile,
    workspace: 'main',
    root: 'media',
    set: {
      title: 'Existing file',
      path: 'existing-file',
      location: 'existing-file.pdf',
      extension: '.pdf',
      size: 2048,
      hash: 'existing-file'
    }
  })
  await createPage(
    db,
    linkScenarioIds.referenceFolder,
    'Reference folder',
    undefined,
    'references',
    'library'
  )
  await createPage(
    db,
    linkScenarioIds.referenceTarget,
    'Reference target',
    linkScenarioIds.referenceFolder,
    'references',
    'library'
  )
  await createPage(
    db,
    linkScenarioIds.referenceOther,
    'Other reference',
    linkScenarioIds.referenceFolder,
    'references',
    'library'
  )
  await db.create({
    id: 'localized-i18-result',
    type: ScenarioPage,
    workspace: 'localized',
    root: 'pages',
    locale: 'en',
    set: {summary: 'Localized search result', title: 'I18 result'}
  })
  await db.create({
    id: 'localized-fr-result',
    type: ScenarioPage,
    workspace: 'localized',
    root: 'pages',
    locale: 'fr',
    set: {summary: 'Localized French result', title: 'French result'}
  })
  return {client: createTestConnection(db), db}
}

function createPage(
  db: LocalDB,
  id: string,
  title: string,
  parentId?: string,
  workspace = 'main',
  root = 'pages'
) {
  return db.create({
    id,
    type: ScenarioPage,
    workspace,
    root,
    parentId,
    set: {summary: `Summary for ${title}`, title}
  })
}

export function LinkFieldScenario() {
  const [scenario] = useState(createLinkFieldScenario)
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
