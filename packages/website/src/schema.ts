import {createSchema, type} from '@alinea/core'
import {list} from '@alinea/input.list'
import {richText} from '@alinea/input.richtext'
import {text} from '@alinea/input.text'

export const schema = createSchema({
  Home: type('Home', {
    title: text('Title', {multiline: true}),
    headline: text('Headline', {multiline: true}),
    byline: text('Byline', {multiline: true})
  }),
  Docs: type(
    'Docs',
    {title: text('Title', {multiline: true})},
    {isContainer: true, contains: ['Doc']}
  ),
  Doc: type('Doc', {
    title: text('Title', {multiline: true}),
    body: richText('Body', {
      blocks: createSchema({
        CodeBlock: type('CodeBlock', {
          code: text('Code', {multiline: true})
        }),
        Inception: type('Inception', {
          wysiwyg: richText('Wysiwyg')
        })
      })
    }),
    blocks: list('List test', {
      schema: createSchema({
        A: type('Type A', {
          field1: text('Field 1')
        }),
        Wysiwyg: type('Wysiwyg', {
          field1: richText('Field 2')
        })
      })
    })
  })
})
