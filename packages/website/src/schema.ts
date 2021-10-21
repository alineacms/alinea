import {channel, createSchema, DataOf, EntryOf} from '@alinea/core'
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
  Doc: channel('Doc', {title: text('Title', {multiline: true})})
})

export const {Home, Docs, Doc} = schema.channels

export type Home = DataOf<typeof Home>
export type Docs = DataOf<typeof Docs>
export type Doc = DataOf<typeof Doc>

export type Page = EntryOf<typeof schema>
