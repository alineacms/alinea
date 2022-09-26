import {createCloudBackend} from '@alinea/cloud'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'
import {alinea, MediaSchema} from 'alinea'
import {Author, BlogContainer, BlogPost, HomePage} from './src/schema'
import {IcRoundPerson} from './src/schema/icons/ic-person'

const schema = alinea.schema({
  ...MediaSchema,
  Author,
  HomePage,
  BlogContainer,
  BlogPost
})

export const config = alinea.createConfig({
  dashboard: {
    staticFile: './public/admin.html',
    dashboardUrl: '/admin.html',
    handlerUrl: '/api/cms'
  },
  backend: createCloudBackend(),
  workspaces: {
    main: alinea.workspace('Blog', {
      source: './content',
      mediaDir: './public/assets',
      schema,
      roots: {
        pages: alinea.root('Blog', {
          icon: IcRoundInsertDriveFile,
          contains: ['HomePage', 'BlogContainer']
        }),
        authors: alinea.root('Authors', {
          icon: IcRoundPerson,
          contains: ['Author']
        }),
        assets: alinea.root('Assets', {
          icon: IcRoundPermMedia,
          contains: ['MediaLibrary']
        })
      }
    })
  }
})
