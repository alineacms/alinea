import {channel, createSchema} from '@alinea/core'
import {text} from '@alinea/input.text'

const home = channel('Home', {
  title: text('Title', {multiline: true}),
  headline: text('Headline', {multiline: true})
})

export const schema = createSchema({
  home
})
