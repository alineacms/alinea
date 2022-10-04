import {Welcome} from '@alinea/dashboard/Welcome'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'
import {alinea, BrowserPreview, MediaSchema} from 'alinea'

export const config = alinea.createConfig({
  workspaces: {
    main: alinea.workspace('Example', {
      source: './content',
      mediaDir: './public',
      schema: alinea.schema({
        ...MediaSchema,
        Page: alinea.type(
          'Page',
          {
            title: alinea.text('Title'),
            path: alinea.path('Path')
          },
          <Welcome />
        )
      }),
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
        // During dev point at running Next.js development server,
        // in production use the current domain
        const location =
          process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
        return (
          <BrowserPreview
            url={`${location}${entry.url}?preview=${previewToken}`}
            // The preview pane will display this url to the user
            prettyUrl={entry.url}
          />
        )
      }
    })
  }
})
