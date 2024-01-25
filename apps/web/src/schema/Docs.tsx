import alinea from 'alinea'
import {bodyField} from './blocks/BodyField'

export const Docs = alinea.document('Docs', {
  navigationTitle: alinea.text('Title in navigation', {
    searchable: true
  }),
  body: bodyField(),
  [alinea.meta]: {
    contains: ['Doc', 'Docs']
  }
})
