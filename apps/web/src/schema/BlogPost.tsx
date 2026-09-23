import {Config, Field} from 'alinea'
import {textField} from './fields/TextField'

export const BlogPost = Config.document('Blog post', {
  fields: {
    publishDate: Field.date('Publish date', {width: 0.5}),
    category: Field.select('Category', {
      width: 0.5,
      initialValue: 'update',
      options: {
        release: 'Release',
        update: 'Update',
        community: 'Community'
      }
    }),
    author: Field.object('Author', {
      fields: {
        name: Field.text('Name', {width: 0.5}),
        url: Field.url('Url', {width: 0.5}),
        avatar: Field.url('Avatar url')
      }
    }),
    introduction: Field.text('Short introduction', {multiline: true}),
    cover: Field.image('Cover image', {
      width: 0.5,
      help: 'Optional, shown on the blog overview and above the post'
    }),
    coverText: Field.text('Cover text', {
      width: 0.5,
      help: 'Shown large on the gradient when there is no cover image, eg. "2.0"'
    }),
    body: textField()
  }
})
