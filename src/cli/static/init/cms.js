import alinea, {createCMS} from 'alinea'

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
      media: alinea.media(),
      [alinea.meta]: {
        source: './content',
        mediaDir: './public'
      }
    })
  }
})
