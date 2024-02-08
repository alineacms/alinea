import {Config, Field} from 'alinea'
import {bodyField} from './blocks/BodyField'

export const Doc = Config.document('Doc', {
  fields: {
    navigationTitle: Field.text('Title in navigation', {
      searchable: true
    }),
    body: bodyField()
  }
})
