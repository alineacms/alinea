import {Config, Field} from 'alinea'
import {textField} from './fields/TextField'

export const BlogPost = Config.document('Blog post', {
  fields: {
    publishDate: Field.date('Publish date'),
    author: Field.object('Author', {
      fields: {
        name: Field.text('Name', {width: 0.5}),
        url: Field.url('Url', {width: 0.5}),
        avatar: Field.url('Avatar url')
      }
    }),
    introduction: Field.text('Short introduction', {multiline: true}),
    body: textField()
  }
})
