import alinea from 'alinea'
import {createCMS} from 'alinea/next'
import * as schema from './schema'

const pages = alinea.root('Pages', {
  index: alinea.page(schema.Home),
  roadmap: alinea.page(schema.Page),
  docs: alinea.page(schema.Docs),
  [alinea.meta]: {
    contains: ['Page', 'Home']
  }
})

const main = alinea.workspace('Alinea', {
  pages,
  media: alinea.media(),
  [alinea.meta]: {
    color: '#3F61E8',
    mediaDir: 'public',
    source: 'content'
  }
})

const config = alinea.config({
  schema,
  workspaces: {main},
  dashboard: {
    dashboardUrl: '/admin.html',
    handlerUrl: '/api/cms',
    staticFile: 'public/admin.html'
  },
  preview:
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/api/preview'
      : '/api/preview'
})

export const cms = createCMS(config)
