import {Config, Field} from 'alinea'

export const FormExample = Config.document('Form', {
  fields: {
    text: Field.form('Text field')
  }
})
