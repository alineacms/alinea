import {Config, Field} from 'alinea'

export const FieldPermissions = Config.document('Field permissions', {
  fields: {
    editable: Field.text('Editable field', {
      help: 'Editor should be able to read and edit this field'
    }),
    readOnlyByRole: Field.text('Read-only by role', {
      help: 'Editor should see this field but not be able to edit it'
    }),
    hiddenByRole: Field.text('Hidden by role', {
      help: 'Editor should not see this field'
    })
  }
})
