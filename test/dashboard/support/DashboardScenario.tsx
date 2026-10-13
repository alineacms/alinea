import type {LocalConnection, Revision} from '#/core/Connection.js'
import {LocalDB} from '#/database/LocalDB.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {User} from '#/core/User.js'
import {App} from '#/dashboard/App.js'
import {IcRoundFormatListNumbered} from '#/dashboard/icons.js'
import type {Entry} from '#/core/Entry.js'
import {Config, Field, Query} from '#/index.js'
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
    title: Field.text('Title', {
      validate: value => value !== 'Invalid' || 'Pick another title'
    }),
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
  },
  seo: {brandShareImage: Field.check('Brand the share image')},
  details: {reviewer: Field.text('Reviewer')}
})

const HiddenFolder = Config.document('Hidden folder', {
  contains: ['HiddenFolder'],
  defaultView: 'overview',
  fields: {},
  hidden: true
})

const OrderedFolder = Config.document('Ordered folder', {
  contains: ['Page'],
  fields: {},
  orderChildrenBy: {asc: Query.title},
  defaultView: 'overview',
  collapsed: true
})

const main = Config.workspace('Main', {
  source: 'main',
  roots: {
    pages: Config.root('Pages', {
      contains: ['Page', 'HiddenFolder', 'OrderedFolder']
    }),
    ordered: Config.root('Ordered pages', {
      contains: ['Page'],
      icon: IcRoundFormatListNumbered,
      orderChildrenBy: {asc: Query.title}
    }),
    localized: Config.root('Localized pages', {
      contains: ['Page'],
      i18n: {locales: ['en', 'fr']}
    }),
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
  schema: {HiddenFolder, OrderedFolder, Page: ScenarioPage},
  workspaces: {main, references}
})

export const slowPreviewDelay = 600

interface SlowPreviewProps {
  entry: Entry
}

const slowPreviews = new Map<string, Promise<string>>()

// A preview component that loads its own data while rendering, like a site
// page rendered inline, so it suspends the first time it renders an entry
function SlowPreview({entry}: SlowPreviewProps) {
  let preview = slowPreviews.get(entry.title)
  if (!preview) {
    preview = new Promise<string>(resolve =>
      setTimeout(() => resolve(entry.title), slowPreviewDelay)
    )
    slowPreviews.set(entry.title, preview)
  }
  return <p>Preview of {use(preview)}</p>
}

const slowPreviewConfig = Config.create({
  enableDrafts: true,
  schema: {HiddenFolder, OrderedFolder, Page: ScenarioPage},
  workspaces: {main, references},
  preview: SlowPreview
})

interface DashboardScenarioState {
  client: LocalConnection
  db: LocalDB
}

export interface DashboardScenarioProps {
  // Answer graph reads one at a time after this many milliseconds, like the
  // dashboard worker does in production
  readDelay?: number
  // Render entry previews with a component that suspends while it loads
  slowPreview?: boolean
  // Fail the first request for the list of users
  failFirstUserList?: boolean
}

class ScenarioDB extends LocalDB {
  readDelay = 0
  /** Entries set up for the scenario are content from before audit metadata,
   * so only the media files that record it show as recently changed */
  seeding = true
  #reads = Promise.resolve()

  mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    if (!this.seeding) return super.mutate(mutations)
    return super.mutate(
      mutations.map(mutation => {
        if (mutation.op !== 'create' || mutation.type === 'MediaFile')
          return mutation
        const {metadata: _, ...data} = mutation.data
        return {...mutation, data}
      })
    )
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    if (!this.readDelay) return super.resolve(query)
    const result = this.#reads
      .then(() => new Promise(resolve => setTimeout(resolve, this.readDelay)))
      .then(() => super.resolve(query))
    this.#reads = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
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

async function createDashboardScenario({
  readDelay = 0,
  slowPreview,
  failFirstUserList
}: DashboardScenarioProps): Promise<DashboardScenarioState> {
  const db = new ScenarioDB(slowPreview ? slowPreviewConfig : config)
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
    id: dashboardScenarioIds.orderedFolder,
    type: OrderedFolder,
    workspace: 'main',
    root: 'pages',
    set: {title: 'Ordered folder'}
  })
  await db.create({
    id: dashboardScenarioIds.orderedZebra,
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    parentId: dashboardScenarioIds.orderedFolder,
    set: {title: 'Zebra'}
  })
  await db.create({
    id: dashboardScenarioIds.orderedApple,
    type: ScenarioPage,
    workspace: 'main',
    root: 'pages',
    parentId: dashboardScenarioIds.orderedFolder,
    set: {title: 'Apple'}
  })
  await db.create({
    id: dashboardScenarioIds.rootOrderedZebra,
    type: ScenarioPage,
    workspace: 'main',
    root: 'ordered',
    set: {title: 'Zebra'}
  })
  await db.create({
    id: dashboardScenarioIds.rootOrderedApple,
    type: ScenarioPage,
    workspace: 'main',
    root: 'ordered',
    set: {title: 'Apple'}
  })
  await db.create({
    id: dashboardScenarioIds.localizedStart,
    locale: 'en',
    type: ScenarioPage,
    workspace: 'main',
    root: 'localized',
    set: {title: 'Localized start'}
  })
  await db.create({
    id: dashboardScenarioIds.localizedFolder,
    locale: 'en',
    type: ScenarioPage,
    workspace: 'main',
    root: 'localized',
    set: {title: 'Localized folder'}
  })
  await db.create({
    id: dashboardScenarioIds.localizedChild,
    locale: 'en',
    parentId: dashboardScenarioIds.localizedFolder,
    type: ScenarioPage,
    workspace: 'main',
    root: 'localized',
    set: {title: 'Localized child'}
  })
  // A link to an entry that is deleted with its parent
  await db.create({
    id: dashboardScenarioIds.childLinking,
    locale: 'en',
    type: ScenarioPage,
    workspace: 'main',
    root: 'localized',
    set: {
      title: 'Child linking',
      relatedPage: {
        _id: 'child-link',
        _type: 'entry',
        _entry: dashboardScenarioIds.localizedChild
      }
    }
  })
  const localizedTitles = {
    en: ['Localized target', 'Localized linking'],
    fr: ['Cible localisée', 'Lien localisé']
  }
  for (const [locale, [target, linking]] of Object.entries(localizedTitles)) {
    await db.create({
      id: dashboardScenarioIds.localizedTarget,
      locale,
      type: ScenarioPage,
      workspace: 'main',
      root: 'localized',
      set: {title: target}
    })
    await db.create({
      id: dashboardScenarioIds.localizedLinking,
      locale,
      type: ScenarioPage,
      workspace: 'main',
      root: 'localized',
      set: {
        title: linking,
        relatedPage: {
          _id: `link-${locale}`,
          _type: 'entry',
          _entry: dashboardScenarioIds.localizedTarget
        }
      }
    })
  }
  // An entry linked from more entries than the delete dialog lists
  await db.create({
    id: dashboardScenarioIds.popularTarget,
    locale: 'en',
    type: ScenarioPage,
    workspace: 'main',
    root: 'localized',
    set: {title: 'Popular target'}
  })
  for (const n of [1, 2, 3, 4])
    await db.create({
      id: `workflow-popular-linking-${n}`,
      locale: 'en',
      type: ScenarioPage,
      workspace: 'main',
      root: 'localized',
      set: {
        title: `Popular linking ${n}`,
        relatedPage: {
          _id: `popular-link-${n}`,
          _type: 'entry',
          _entry: dashboardScenarioIds.popularTarget
        }
      }
    })
  await db.create({
    id: dashboardScenarioIds.popularChild,
    locale: 'en',
    parentId: dashboardScenarioIds.popularTarget,
    type: ScenarioPage,
    workspace: 'main',
    root: 'localized',
    set: {title: 'Popular child'}
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
  // Uploads record who created and last replaced a file, in seconds
  const now = Math.floor(Date.now() / 1000)
  const alice = {name: 'Alice Editor', email: 'alice@example.com'}
  const local = {name: 'Local user', email: 'local@example.com'}
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
    },
    {
      op: 'create',
      id: dashboardScenarioIds.mediaFolder,
      type: 'MediaLibrary',
      locale: null,
      workspace: 'main',
      root: 'media',
      data: {title: 'Media folder', path: 'media-folder'}
    },
    {
      op: 'create',
      id: dashboardScenarioIds.nestedMediaFolder,
      type: 'MediaLibrary',
      locale: null,
      workspace: 'main',
      root: 'media',
      parentId: dashboardScenarioIds.mediaFolder,
      data: {title: 'Nested media folder', path: 'nested-media-folder'}
    },
    {
      op: 'create',
      id: dashboardScenarioIds.nestedMediaFile,
      type: 'MediaFile',
      locale: null,
      workspace: 'main',
      root: 'media',
      parentId: dashboardScenarioIds.nestedMediaFolder,
      data: {
        title: 'Nested media file',
        path: 'nested-media-file',
        location: 'media-folder/nested-media-folder/nested-media-file.jpg',
        extension: '.jpg',
        size: 1024,
        hash: 'nested-media-file',
        alt: null,
        metadata: {
          createdAt: now - 3 * 24 * 60 * 60,
          createdBy: alice,
          updatedAt: now - 60 * 60,
          updatedBy: local
        }
      }
    },
    {
      op: 'create',
      id: dashboardScenarioIds.uploadedMediaFile,
      type: 'MediaFile',
      locale: null,
      workspace: 'main',
      root: 'media',
      data: {
        title: 'Uploaded image',
        path: 'uploaded-image',
        location: 'uploaded-image.jpg',
        extension: '.jpg',
        size: 1024,
        hash: 'uploaded-image',
        alt: null,
        metadata: {
          createdAt: now - 2 * 60 * 60,
          createdBy: alice,
          updatedAt: now - 2 * 60 * 60,
          updatedBy: alice
        }
      }
    }
  ])
  // A link to a file inside a media folder
  await db.create({
    id: dashboardScenarioIds.mediaLinking,
    locale: 'en',
    type: ScenarioPage,
    workspace: 'main',
    root: 'localized',
    set: {
      title: 'Media linking',
      relatedPage: {
        _id: 'media-link',
        _type: 'entry',
        _entry: dashboardScenarioIds.nestedMediaFile
      }
    }
  })
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
  db.seeding = false
  db.readDelay = readDelay
  const baseClient = createTestConnection(db, {users})
  let failUserList = failFirstUserList
  const client: LocalConnection = {
    ...baseClient,
    listUsers() {
      if (!failUserList) return baseClient.listUsers()
      failUserList = false
      return Promise.reject(new Error('Users are unavailable'))
    },
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

export function DashboardScenario(props: DashboardScenarioProps) {
  const [scenario] = useState(() => createDashboardScenario(props))
  const {client, db} = use(scenario)
  return (
    <App
      graph={db}
      events={db.events}
      config={props.slowPreview ? slowPreviewConfig : config}
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
