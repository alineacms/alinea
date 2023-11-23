import {createCloudBackend} from 'alinea/cloud'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {alinea, BrowserPreview, MediaSchema} from 'alinea'

const schema = alinea.schema({
  ...MediaSchema,
  Welcome: alinea.type('Welcome', {
    title: alinea.text('Title', {width: 0.5}),
    path: alinea.path('Path', {width: 0.5}),
    body: alinea.richText('Body text')
  })
})

export const config = alinea.createConfig({
  schema,
  dashboard: {
    staticFile: './public/admin.html',
    dashboardUrl: '/admin.html',
    handlerUrl: '/cms'
  },
  backend: createCloudBackend(),
  workspaces: {
    main: alinea.workspace('Remix example', {
      source: './content',
      mediaDir: './public',
      roots: {
        data: alinea.root('Example project', {
          icon: IcRoundInsertDriveFile,
          contains: ['Page']
        }),
        media: alinea.root('Media', {
          icon: IcRoundPermMedia,
          contains: ['MediaLibrary']
        })
      },
      preview({entry, previewToken}) {
        // During dev point at running Remix development server,
        // in production use the current domain
        const location =
          process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
        return (
          <BrowserPreview
            url={`${location}${entry.url}?${previewToken}`}
            // The preview pane will display this url to the user
            prettyUrl={entry.url}
          />
        )
      }
    })
  }
})
