import {Config} from 'alinea'
import {createCMS} from 'alinea/next'
import {demoWorkspace} from '@/page/demo/demoWorkspace'
import * as schema from '@/schema'

const pages = Config.root('Pages', {
  contains: ['Page', 'Home', 'Landing'],
  children: {
    index: Config.page({type: schema.Home}),
    docs: Config.page({type: schema.Docs})
  }
})

const main = Config.workspace('Alinea', {
  color: '#3F61E8',
  mediaDir: 'public',
  source: 'content/main',
  roots: {
    pages,
    media: Config.media()
  }
})

export const cms = createCMS({
  enableDrafts: true,
  schema,
  workspaces: {main, demo: demoWorkspace},
  baseUrl: {
    production: 'https://alineacms.com',
    development: 'http://localhost:3000'
  },
  handlerUrl: '/api/cms',
  dashboardFile: 'admin.html',
  preview: true
})
