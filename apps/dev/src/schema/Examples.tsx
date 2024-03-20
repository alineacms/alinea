import {Config, Query} from 'alinea'
import * as examples from './example'

export const Examples = Config.document('Examples', {
  contains: Object.values(examples),
  orderChildrenBy: Query.title.asc(),
  fields: {}
})
