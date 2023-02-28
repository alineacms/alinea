import {alinea, MediaSchema} from 'alinea'
import {Welcome} from 'alinea/dashboard/Welcome'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'

export const config = alinea.createConfig({
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
  workspaces: {
    main: alinea.workspace('Example', {
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
      }
    })
  }
})
