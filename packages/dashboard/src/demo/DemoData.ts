import {JWTPreviews} from '@alinea/backend'
import {IndexedDBData, IndexedDBDrafts} from '@alinea/backend.indexeddb'
import {Server} from '@alinea/backend/Server'
import {demoStore} from '@alinea/backend/util/DemoStore'
import {createConfig, Media, root, schema, type, workspace} from '@alinea/core'
import {MediaSchema} from '@alinea/dashboard/schema/MediaSchema'
import {path} from '@alinea/input.path'
import {text} from '@alinea/input.text'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'

const Page = type('Page', {
  title: text('Title'),
  path: path('Path')
  // content: richText('Content')
})

const demoSchema = schema({
  ...MediaSchema,
  Page
})

const demo = workspace('Demo', {
  schema: demoSchema,
  source: './content',
  color: 'yellow',
  roots: {
    data: root('Demo website', {
      icon: IcRoundInsertDriveFile,
      contains: ['Page']
    }),
    media: root('Media', {
      icon: IcRoundPermMedia,
      contains: ['MediaLibrary']
    })
  }
})

const config = createConfig({
  workspaces: {demo}
})

function createLocalClient() {
  const data = new IndexedDBData()
  return new Server({
    config,
    createStore: demoStore(config, workspace => {
      return [
        {
          id: 'home',
          type: 'Page',
          title: 'Homepage',
          path: 'index',
          root: 'data'
        },
        {
          id: 'page2',
          type: 'Page',
          title: 'Page 2',
          path: 'page-2',
          root: 'data'
        },
        {
          id: 'media',
          type: Media.Type.Libary,
          title: 'Media library',
          path: 'media',
          root: 'media'
        }
      ]
    }),
    drafts: new IndexedDBDrafts(),
    target: data,
    media: data,
    previews: new JWTPreviews('demo')
  })
}

export function createDemo() {
  const client = createLocalClient()
  return {
    config,
    client,
    session: {
      user: {sub: 'anonymous'},
      hub: client,
      end: async () => {}
    }
  }
}
