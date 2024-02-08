import {Config} from 'alinea'
import {createCMS} from 'alinea/next'
import * as schema from './schema'

const pages = Config.root('Pages', {
  contains: ['Page', 'Home'],
  entries: {
    index: Config.page(schema.Home),
    roadmap: Config.page(schema.Page),
    docs: Config.page(schema.Docs)
  }
})

const main = Config.workspace('Alinea', {
  color: '#3F61E8',
  mediaDir: 'public',
  source: 'content',
  roots: {
    pages,
    media: Config.media()
  }
})

const config = Config.create({
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
