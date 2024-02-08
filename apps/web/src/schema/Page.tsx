import alinea from 'alinea'
import {textField} from './blocks/TextBlock'

export const Page = alinea.document('Page', {
  fields: {
    body: textField()
  }
})
