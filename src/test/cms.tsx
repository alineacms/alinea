import {Config} from 'alinea'
import {createCMS} from 'alinea/core'
import * as schema from './schema/index.js'

const demo = Config.workspace('Demo', {
  color: '#FFA500',
  mediaDir: 'public',
  source: 'content/demo',
  roots: {
    pages: Config.root('Demo', {
      contains: ['DemoHome', 'DemoRecipes']
      /*children: {
        index: Config.page({type: schema.DemoHome, fields: {title: 'Home'}}),
        recipes: Config.page({
          type: schema.DemoRecipes,
          fields: {title: 'Recipes'}
        })
      }*/
    }),
    media: Config.media()
  }
})
export const cms = createCMS({
  schema,
  workspaces: {demo},
  baseUrl: {
    production: process.env.VERCEL_URL ?? 'alineacms.com',
    development: 'http://localhost:3000'
  },
  handlerUrl: '/api/cms',
  dashboardFile: 'admin.html',
  preview: true
})
