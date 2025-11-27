import {Config, Field} from 'alinea'
import {FormFileField} from 'alinea/field/form/base/FormFileField'
import {FormSelectField} from 'alinea/field/form/base/FormSelectField'
import {FormTextField} from 'alinea/field/form/base/FormTextField'
import {MyField} from './project-specific-field/MyField'

export const Form = Config.type('Form', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    description: Field.text('Description', {multiline: true}),
    form: Field.form('Form', {
      baseFields: {
        MyField,
        FormFileField,
        FormSelectField,
        FormTextField
      }
    })
  }
})
