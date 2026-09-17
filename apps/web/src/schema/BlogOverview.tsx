import {Config} from 'alinea'

export const BlogOverview = Config.document('Blog overview', {
  contains: ['BlogPost'],
  fields: {}
})
