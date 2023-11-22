import alinea from 'alinea'
import {BodyField} from './blocks/BodyField'

export const Doc = alinea.document('Doc', {
  body: BodyField
})
