import {Config} from 'alinea'
import {createCMS} from 'alinea/server'

// Create types for your CMS schema
const Page = Config.document('Page', {
  fields: {}
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
      mediaDir: 'static/media',
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
    development: 'http://localhost:5173',
    // The production URL of your website
    production: 'https://example.com'
  },

  // Live previews of draft pages, refreshed by src/hooks.client.ts
  preview: true,

  // The handler route URL
  handlerUrl: '/api/cms',
  adminPath: '/admin',
  // SvelteKit serves static files from static/
  publicDir: 'static'
})
