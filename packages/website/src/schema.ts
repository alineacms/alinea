import {channel, createSchema, DataOf, EntryOf} from '@alinea/core'
import {list} from '@alinea/input.list'
import {richText} from '@alinea/input.richtext'
import {text} from '@alinea/input.text'

export const schema = createSchema({
  Home: channel('Home', {
    title: text('Title', {multiline: true}),
    headline: text('Headline', {multiline: true}),
    byline: text('Byline', {multiline: true})
  }),
  Docs: channel(
    'Docs',
    {title: text('Title', {multiline: true})},
    {isContainer: true, contains: ['Doc']}
  ),
  Doc: channel('Doc', {
    title: text('Title', {multiline: true}),
    body: richText('Body'),
    blocks: list('List test', {
      schema: createSchema({
        A: channel('Type A', {
          field1: text('Field 1')
        }),
        B: channel('Type B', {
          field1: text('Field 2')
        })
      })
    })
  })
})

export const {Home, Docs, Doc} = schema.collections

export type Home = DataOf<typeof Home>
export type Docs = DataOf<typeof Docs>
export type Doc = DataOf<typeof Doc>

export type Page = EntryOf<typeof schema>
