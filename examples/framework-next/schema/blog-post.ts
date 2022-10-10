import {Entry} from '@alinea/core'
import alinea from 'alinea'

export const BlogPost = alinea.type(
  'Blog post',
  alinea.tabs(
    alinea.tab('Content', {
      title: alinea.text('Title', {width: 0.5}),
      path: alinea.path('Path', {width: 0.5}),
      date: alinea.date('Publish date'),
      coverImage: alinea.image('Cover image', {width: 0.5}),
      author: alinea.entry('Author', {
        width: 0.5,
        condition: Entry.type.is('Author')
      }),
      excerpt: alinea.richText('Excerpt'),
      content: alinea.richText('Content')
    }),
    alinea.tab('Metadata', {
      ogImage: alinea.image('OG Image')
    })
  )
)
