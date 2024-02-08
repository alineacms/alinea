import alinea from 'alinea'
import {bodyField} from './blocks/BodyField'

export const Doc = alinea.document('Doc', {
  fields: {
    navigationTitle: alinea.text('Title in navigation', {
      searchable: true
    }),
    body: bodyField()
  }
})
