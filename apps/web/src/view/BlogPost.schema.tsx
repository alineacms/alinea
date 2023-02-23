import {type} from 'alinea/core'
import {date} from 'alinea/input/date'
import {link} from 'alinea/input/link'
import {object} from 'alinea/input/object'
import {path} from 'alinea/input/path'
import {text} from 'alinea/input/text'
import {BlocksSchema} from './blocks/Blocks.schema'

export const BlogPostSchema = type('Blog post', {
  title: text('Title', {width: 0.5}),
  path: path('Path', {width: 0.5}),
  publishDate: date('Publish date'),
  author: object('Author', {
    fields: type('Author fields', {
      name: text('Name', {width: 0.5}),
      url: link.url('Url', {width: 0.5}),
      avatar: link.url('Avatar url')
    })
  }),
  blocks: BlocksSchema
})
