import alinea from 'alinea'
import {BodyField} from './blocks/BodyField'

export const Doc = alinea.document('Doc', {
  navigationTitle: alinea.text('Title in navigation'),
  body: BodyField
})
