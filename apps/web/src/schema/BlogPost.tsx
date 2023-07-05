import alinea from 'alinea'
import {TextField} from './blocks/TextBlock'

export const BlogPost = alinea.type('Blog post', {
  title: alinea.text('Title', {width: 0.5}),
  path: alinea.path('Path', {width: 0.5}),
  publishDate: alinea.date('Publish date'),
  author: alinea.object('Author', {
    fields: alinea.type('Author fields', {
      name: alinea.text('Name', {width: 0.5}),
      url: alinea.link.url('Url', {width: 0.5}),
      avatar: alinea.link.url('Avatar url')
    })
  }),
  body: TextField
})
