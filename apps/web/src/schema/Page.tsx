import {Config} from 'alinea'
import {textField} from './fields/TextField'

export const Page = Config.document('Page', {
  fields: {
    body: textField()
  }
})
