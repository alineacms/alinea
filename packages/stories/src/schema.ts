import {channel, Schema} from '@alinea/core'
import {list} from '@alinea/input.list'
import {text} from '@alinea/input.text'

export const schema = new Schema({
  page: channel('Page', {
    title: text('Title', {
      multiline: true,
      help: 'Wordt gebruikt in de website of app (interne titel wordt gebruikt indien leeg)',
      optional: true
    }),
    multi: text('Multi', {
      multiline: true
    }),
    blocks: list('Blocks', {
      of: {
        textblock: channel('Text block', {
          text: text('Text')
        })
      }
    })
  })
})
