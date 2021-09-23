import {channel, Schema} from '@alinea/core'
import {number} from '@alinea/input.number'
import {text} from '@alinea/input.text'

export const schema = new Schema({
  page: channel('Page', {
    title: text('Title'),
    nr: number('Mijn nummer')
  })
})
