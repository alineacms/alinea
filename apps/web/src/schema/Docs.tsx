import alinea from 'alinea'
import {BodyField} from './blocks/BodyField'

export const Docs = alinea.document('Docs', {
  body: BodyField,
  [alinea.meta]: {
    isContainer: true,
    contains: ['Doc', 'Docs']
  }
})
