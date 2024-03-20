import {Config, Field} from 'alinea'

export const BlogOverview = Config.type('Blog overview', {
  contains: ['BlogPost'],
  fields: {
    title: Field.text('Title', {width: 0.5}),
    path: Field.path('Path', {width: 0.5})
  }
})
