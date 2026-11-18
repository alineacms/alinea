import {Config, Field} from '#/index.js'

const Page = Config.document('Page', {
  fields: {
    body: Field.text('Body', {multiline: true}),
    rows: Field.list('Rows', {
      schema: {Row: Config.type('Row', {fields: {text: Field.text('Text')}})}
    })
  }
})

export const config = Config.create({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})
