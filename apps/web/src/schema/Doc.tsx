import {Config, Field} from 'alinea'
import {bodyField} from './fields/BodyField'

export const Doc = Config.document('Doc', {
  fields: {
    navigationTitle: Field.text('Title in navigation', {
      searchable: true
    }),
    body: bodyField()
  }
})
