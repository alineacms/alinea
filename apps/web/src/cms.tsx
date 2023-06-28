import alinea, {createNextCMS} from 'alinea'
import * as schema from './schema'

export const pages = alinea.root('Pages', {
  index: alinea.page(schema.Home),
  roadmap: alinea.page(schema.Page),
  docs: alinea.page(schema.Docs),
  [alinea.meta]: {
    contains: ['Page', 'Home']
  }
})

export const cms = createNextCMS({
  dashboard: {
    dashboardUrl: '/admin.html',
    handlerUrl: '/api/cms',
    staticFile: '../public/admin.html'
  },
  schema,
  workspaces: {
    main: alinea.workspace('Alinea website', {
      pages,
      media: alinea.media,
      [alinea.meta]: {
        color: '#3F61E8',
        mediaDir: '../public',
        source: '../content'
      }
    })
  },
  preview:
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/api/preview'
      : '/api/preview'
})
