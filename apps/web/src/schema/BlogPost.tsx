import alinea from 'alinea'
import {textField} from './blocks/TextBlock'

export const BlogPost = alinea.document('Blog post', {
  fields: {
    publishDate: alinea.date('Publish date'),
    author: alinea.object('Author', {
      fields: alinea.type('Author fields', {
        name: alinea.text('Name', {width: 0.5}),
        url: alinea.link.url('Url', {width: 0.5}),
        avatar: alinea.link.url('Avatar url')
      })
    }),
    introduction: alinea.text('Short introduction', {multiline: true}),
    body: textField()
  }
})
