import {Config, Field} from 'alinea'

export const Post = Config.document('Post page', {
  fields: {
    title: Field.text('Title', {required: true, width: 0.5}),
    path: Field.path('Path', {required: true, width: 0.5}),
    excerpt: Field.text('Excerpt', {multiline: true}),
    body: Field.richText('Body')
  }
})
