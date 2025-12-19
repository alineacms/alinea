import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'

// Create types for your CMS schema
const Page = Config.type('Page', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path')
  }
})

export const cms = createCMS({
  // List out available types in your schema
  schema: {
    Page
  },

  // Define the content structure of your CMS
  workspaces: {
    main: Config.workspace('Example', {
      source: 'content',
      mediaDir: 'public',
      roots: {
        pages: Config.root('Example site', {
          contains: ['Page']
        }),
        media: Config.media()
      }
    })
  },

  baseUrl: {
    // Point to your local website
    development: 'http://localhost:3000',
    // The production URL of your website
    production: 'https://example.com'
  },

  // Enable live previews after adding <cms.previews widget /> to your layout
  // preview: true,

  // The handler route URL
  handlerUrl: '/api/cms',

  // The admin dashboard will be bundled in this static file
  dashboardFile: 'admin.html'
})
