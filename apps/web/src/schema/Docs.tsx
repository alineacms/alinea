import {Config, Field} from 'alinea'
import {bodyField} from './blocks/BodyField'

export const Docs = Config.document('Docs', {
  contains: ['Doc', 'Docs'],
  fields: {
    navigationTitle: Field.text('Title in navigation', {
      searchable: true
    }),
    body: bodyField()
  }
})
