import {Config, Field} from 'alinea'
import {textField} from './blocks/TextBlock'

export const BlogPost = Config.document('Blog post', {
  fields: {
    publishDate: Field.date('Publish date'),
    author: Field.object('Author', {
      fields: {
        name: Field.text('Name', {width: 0.5}),
        url: Field.link.url('Url', {width: 0.5}),
        avatar: Field.link.url('Avatar url')
      }
    }),
    introduction: Field.text('Short introduction', {multiline: true}),
    body: textField()
  }
})
