import alinea from 'alinea'
import {TextField} from './blocks/TextBlock'

export const Doc = alinea.document('Doc', {
  body: TextField
})
