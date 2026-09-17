import {Config} from 'alinea'
import {createCMS} from 'alinea/next'
import {LandingPage} from '@/entries/landing/LandingPage.schema'

export const cms = createCMS({
  schema: {LandingPage},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      mediaDir: 'public',
      roots: {
        pages: Config.root('Pages', {
          contains: ['LandingPage'],
          children: {
            index: Config.page({
              type: LandingPage,
              fields: {
                title: 'Welcome',
                path: ''
              }
            })
          }
        }),
        media: Config.media()
      }
    })
  },
  baseUrl: {
    development: 'http://localhost:3101'
  },
  handlerUrl: '/api/cms',
  dashboardFile: 'admin.html',
  preview: true
})
