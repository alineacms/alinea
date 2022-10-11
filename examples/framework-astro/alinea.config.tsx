import {createCloudBackend} from '@alinea/cloud'
import {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview'
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
  schema,
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
      },
      preview({entry, previewToken}) {
        const noPreviews = new Set(['Docs', 'MediaLibrary'])
        if (noPreviews.has(entry.type)) return null
        const location =
          process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
        return (
          <BrowserPreview
            // reload
            url={`${location}?${previewToken}`}
            prettyUrl={entry.url}
          />
        )
      }
    })
  }
})
