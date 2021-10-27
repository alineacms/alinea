import {createSchema, Type, type} from '@alinea/core'
import {list} from '@alinea/input.list'
import {text} from '@alinea/input.text'

const blocks = list('Blocks', {
  schema: createSchema({
    textblock: type('Text block', {
      text: text('Text')
    })
  })
})

const page = type('Page', {
  title: text('Title', {
    multiline: true,
    help: 'Wordt gebruikt in de website of app (interne titel wordt gebruikt indien leeg)',
    optional: true
  }),
  multi: text('Multi', {
    multiline: true
  }),
  blocks
})

export type Page = Type.Of<typeof page>

export const schema = createSchema({page})
