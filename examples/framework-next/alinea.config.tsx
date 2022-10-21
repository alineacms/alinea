import {createCloudBackend} from '@alinea/cloud'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'
import {alinea, BrowserPreview, MediaSchema} from 'alinea'
import {Author, BlogContainer, BlogPost, HomePage} from './schema'
import {IcRoundPerson} from './schema/icons/ic-person'

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
        // During dev point at running Next.js development server,
        // in production use the current domain
        const location =
          process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
        if (['Author', 'BlogContainer'].includes(entry.type)) return null
        return (
          <BrowserPreview
            url={`${location}/api/preview?${previewToken}`}
            // The preview pane will display this url to the user
            prettyUrl={entry.url}
          />
        )
      }
    })
  }
})
