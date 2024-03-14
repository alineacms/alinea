import {Config, Field} from 'alinea'

export const I18nExamples = Config.document('I18n', {
  fields: {
    shared: Field.text('Shared field', {
      help: `This field is shared between languages.`,
      shared: true
    })
  }
})
