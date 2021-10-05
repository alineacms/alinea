import {channel, schema} from '@alinea/core'
import {text} from '@alinea/input.text'

export const pagesSchema = schema({
  page: channel('Page', {
    title: text('Title')
  })
})
