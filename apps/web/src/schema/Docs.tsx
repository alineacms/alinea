import alinea from 'alinea'
import {bodyField} from './blocks/BodyField'

export const Docs = alinea.document('Docs', {
  navigationTitle: alinea.text('Title in navigation'),
  body: bodyField(),
  [alinea.meta]: {
    isContainer: true,
    contains: ['Doc', 'Docs']
  }
})
