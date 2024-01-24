import alinea from 'alinea'
import {bodyField} from './blocks/BodyField'

export const Doc = alinea.document('Doc', {
  navigationTitle: alinea.text('Title in navigation', {
    searchable: true,
    optional: true
  }),
  body: bodyField()
})
