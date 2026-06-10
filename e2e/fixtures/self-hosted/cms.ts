import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'

export const Page = Config.type('Page', {
  fields: {
    title: Field.text('Title', {width: 0.5}),
    path: Field.path('Path', {width: 0.5}),
    body: Field.richText('Body')
  }
})

export const cms = createCMS({
  handlerUrl: '/api',
  baseUrl: {
    development: 'http://localhost:4500',
    production: 'http://localhost:4500'
  },
  schema: {Page},
  workspaces: {
    main: Config.workspace('Self hosted', {
      mediaDir: 'media',
      source: 'content',
      roots: {
        pages: Config.root('Pages', {
          contains: [Page]
        }),
        media: Config.media()
      }
    })
  }
})
