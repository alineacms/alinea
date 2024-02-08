import {Config} from 'alinea'
import {textField} from './blocks/TextBlock'

export const Page = Config.document('Page', {
  fields: {
    body: textField()
  }
})
