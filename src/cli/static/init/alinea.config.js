import alinea, {createCMS} from 'alinea'
import {MediaLibrary} from 'alinea/core/media/MediaSchema'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'

const Page = alinea.type('Page', {
  title: alinea.text('Title'),
  path: alinea.path('Path')
})

export const cms = createCMS({
  schema: {
    Page
  },
  workspaces: {
    main: alinea.workspace('Example', {
      pages: alinea.root('Example project', {
        welcome: alinea.page(
          Page({
            title: 'Welcome'
          })
        ),
        [alinea.meta]: {
          contains: ['Page']
        }
      }),
      media: alinea.root('Media', {
        media: alinea.page(
          MediaLibrary({
            title: 'Media library'
          })
        ),
        [alinea.meta]: {
          icon: IcRoundPermMedia,
          contains: ['MediaLibrary']
        }
      }),
      [alinea.meta]: {
        source: './content',
        mediaDir: './public'
      }
    })
  }
})
