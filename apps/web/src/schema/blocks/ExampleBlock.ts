import {Config, Field} from 'alinea'

export const ExampleBlock = Config.type('Example', {
  fields: {
    code: Field.code('Code', {inline: true})
  }
})
