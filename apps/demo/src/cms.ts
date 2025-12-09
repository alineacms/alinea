import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/next'
import {Form} from './Form.schema'

export const cms = createCMS({
  // List out available types in your schema
  schema: {
    Form
  },

  // Define the content structure of your CMS
  workspaces: {
    main: Config.workspace('Form examples', {
      preview: true,
      source: 'content',
      mediaDir: 'public',
      roots: {
        pages: Config.root('Forms', {
          contains: ['Form']
        }),
        media: Config.media()
      }
    })
  },

  baseUrl: {
    // Point to your local website
    development: 'http://localhost:3000',
    // The production URL of your website
    production: 'https://alinea-blue.vercel.app/'
  },

  // Enable live previews after adding <cms.previews widget /> to your layout
  // preview: true,

  // The handler route URL
  handlerUrl: '/api/cms',

  // The admin dashboard will be bundled in this static file
  dashboardFile: 'admin.html'
})
