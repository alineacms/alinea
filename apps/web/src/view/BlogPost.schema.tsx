import {Schema, type} from '@alinea/core'
import {date} from '@alinea/input.date'
import {path} from '@alinea/input.path'
import {text} from '@alinea/input.text'
import {BlocksSchema} from './blocks/Blocks.schema'

export const BlogPostSchema = type('Blog post', {
  title: text('Title', {width: 0.5}),
  path: path('Path', {width: 0.5}),
  publishDate: date('Publish date'),
  blocks: BlocksSchema
})

export type BlogPostSchema = Schema.TypeOf<typeof BlogPostSchema>
