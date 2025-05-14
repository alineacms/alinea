import {Config, Field} from 'alinea'

export const SharedFields = Config.document('Shared fields', {
  fields: {
    sharedSelect: Field.select('Shared select', {
      shared: true,
      options: {
        option1: 'Option 1',
        option2: 'Option 2',
        option3: 'Option 3'
      }
    })
  }
})
