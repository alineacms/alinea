import {channel, createSchema} from '@alinea/core'
import {list} from '@alinea/input.list'
import {text} from '@alinea/input.text'

const Home = channel('Home', {
  title: text('Title', {multiline: true}),
  headline: text('Headline', {multiline: true}),
  list: list('List', {
    schema: createSchema({
      item: channel('Item', {
        field: text('Item', {multiline: true})
      })
    })
  })
})

export const schema = createSchema({
  Home
})
