import alinea from 'alinea'
import * as schema from './src/schema'

namespace workspaces {
  const pages = alinea.root('Pages', {
    index: alinea.page(schema.Home),
    roadmap: alinea.page(schema.Page),
    docs: alinea.page(schema.Docs),
    [alinea.meta]: {
      contains: ['Page', 'Home']
    }
  })

  export const main = alinea.workspace('Alinea', {
    pages,
    media: alinea.media(),
    [alinea.meta]: {
      color: '#3F61E8',
      mediaDir: 'public',
      source: 'content'
    }
  })
}

export const config = alinea.config({
  dashboardFile: 'admin.html',
  handlerUrl: '/api/cms',
  schema,
  workspaces,
  preview:
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/api/preview'
      : '/api/preview'
})
