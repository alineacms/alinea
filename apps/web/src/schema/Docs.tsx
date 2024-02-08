import alinea from 'alinea'
import {bodyField} from './blocks/BodyField'

export const Docs = alinea.document('Docs', {
  contains: ['Doc', 'Docs'],
  fields: {
    navigationTitle: alinea.text('Title in navigation', {
      searchable: true
    }),
    body: bodyField()
  }
})
