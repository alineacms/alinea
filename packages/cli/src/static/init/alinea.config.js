import {Welcome} from '@alinea/dashboard/Welcome'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'
import {alinea} from 'alinea'

export const config = alinea.createConfig({
  workspaces: {
    main: alinea.workspace('Example', {
      source: './content',
      mediaDir: './public',
      schema: alinea.schema({
        ...alinea.MediaSchema,
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
      }
    })
  }
})
