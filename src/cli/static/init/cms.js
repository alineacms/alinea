import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'

const Page = Config.type('Page', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path')
  }
})

export const cms = createCMS({
  schema: {
    Page
  },
  workspaces: {
    main: Config.workspace('Example', {
      source: 'content',
      mediaDir: 'public',
      roots: {
        site: Config.root('Example site', {
          contains: ['Page'],
          children: {
            welcome: Config.page({
              type: Page,
              fields: {
                title: 'Welcome'
              }
            })
          }
        }),
        media: Config.media()
      }
    })
  }
})
