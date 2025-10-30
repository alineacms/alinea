import {Config, Field} from 'alinea'

export const Form = Config.type('Form', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    description: Field.text('Description', {multiline: true}),
    form: Field.form('Form')
  }
})
