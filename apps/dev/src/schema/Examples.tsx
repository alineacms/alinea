import {Config} from 'alinea'
import * as examples from './example'

export const Examples = Config.document('Examples', {
  contains: Object.values(examples),
  // orderChildrenBy: {asc: Entry.title},
  fields: {}
})
