import * as schema from '@/schema'
import {Config} from 'alinea'
import {createCMS} from 'alinea/next'

const pages = Config.root('Pages', {
  contains: ['Page', 'Home'],
  children: {
    index: Config.page({type: schema.Home}),
    roadmap: Config.page({type: schema.Page}),
    docs: Config.page({type: schema.Docs})
  }
})

function MdiPlayBox() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M19 3H5c-1.11 0-2 .89-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5a2 2 0 0 0-2-2m-9 13V8l5 4"
      />
    </svg>
  )
}

const main = Config.workspace('Alinea', {
  color: '#3F61E8',
  mediaDir: 'public',
  source: 'content/main',
  roots: {
    pages,
    media: Config.media()
  }
})

const demo = Config.workspace('Demo', {
  color: '#FFA500',
  mediaDir: 'public',
  source: 'content/demo',
  icon: MdiPlayBox,
  roots: {
    pages: Config.root('Demo', {
      contains: ['DemoHome', 'DemoRecipes'],
      children: {
        index: Config.page({type: schema.DemoHome, fields: {title: 'Home'}}),
        recipes: Config.page({
          type: schema.DemoRecipes,
          fields: {title: 'Recipes'}
        })
      }
    }),
    media: Config.media()
  }
})
export const cms = createCMS({
  enableDrafts: true,
  schema,
  workspaces: {main, demo},
  baseUrl: {
    production: process.env.VERCEL_URL ?? 'alineacms.com',
    development: 'http://localhost:3000'
  },
  handlerUrl: '/api/cms',
  dashboardFile: 'admin.html',
  preview: true
})
