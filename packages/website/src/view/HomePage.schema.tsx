import {Schema, type} from '@alinea/core'
import {path} from '@alinea/input.path'
import {text} from '@alinea/input.text'

export const HomePageSchema = type('Home', {
  title: text('Title', {
    width: 0.5,
    multiline: true
  }),
  path: path('Path', {width: 0.5}),
  headline: text('Headline', {multiline: true}),
  byline: text('Byline', {multiline: true})
}).configure({isContainer: true})

export type HomePageSchema = Schema.TypeOf<typeof HomePageSchema>
