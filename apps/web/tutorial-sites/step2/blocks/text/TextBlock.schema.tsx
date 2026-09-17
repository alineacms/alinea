import {Config, Field} from 'alinea'

export const TextBlock = Config.type('Text block', {
  fields: {
    body: Field.richText('Text', {inline: true})
  }
})
