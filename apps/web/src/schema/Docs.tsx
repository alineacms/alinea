import alinea from 'alinea'
import {BodyField} from './blocks/BodyField'

export const Docs = alinea.document('Docs', {
  navigationTitle: alinea.text('Title in navigation'),
  body: BodyField,
  [alinea.meta]: {
    isContainer: true,
    contains: ['Doc', 'Docs']
  }
})
