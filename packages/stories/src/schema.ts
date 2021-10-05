import {Channel, channel, schema} from '@alinea/core'
import {list} from '@alinea/input.list'
import {text} from '@alinea/input.text'

const blocks = list('Blocks', {
  schema: schema({
    textblock: channel('Text block', {
      text: text('Text')
    })
  })
})

const page = channel('Page', {
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

export type Page = Channel.TypeOf<typeof page>

export const mySchema = schema({page})
