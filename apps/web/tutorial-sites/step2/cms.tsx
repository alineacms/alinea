import {Config} from 'alinea'
import {createCMS} from 'alinea/next'
import {LandingPage} from '@/entries/landing/LandingPage.schema'

export const cms = createCMS({
  schema: {LandingPage},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      mediaDir: 'public/media',
      roots: {
        pages: Config.root('Pages', {
          contains: ['LandingPage'],
          children: {
            // Optionally seed this page, alternatively you can simply create the page from the CMS directly
            index: Config.page({
              type: LandingPage,
              fields: {
                title: 'Welcome'
              }
            })
          }
        }),
        media: Config.media()
      }
    })
  },
  baseUrl: {
    development: 'http://localhost:3102',
    production: 'https://example.com'
  },
  handlerUrl: '/api/cms',
  adminPath: '/admin',
  preview: true
})
