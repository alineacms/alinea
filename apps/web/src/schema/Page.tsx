import alinea from 'alinea'
import {TextField} from './blocks/TextBlock'

export const Page = alinea.document('Page', {
  body: TextField
})
