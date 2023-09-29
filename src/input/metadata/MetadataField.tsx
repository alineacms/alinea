import {type} from 'alinea/core'
import {link} from 'alinea/input/link'
import {tab, tabs} from 'alinea/input/tabs'
import {text} from 'alinea/input/text'
import {object} from '../object.js'

export function metadata() {
  return object('Meta', {
    fields: type(
      'Fields',
      tabs(
        tab('Search engines', {
          title: text('Title'),
          description: text('Description', {multiline: true}),
          image: link.image('Image')
        }),

        tab('Social media', {
          'og:title': text('Title'),
          'og:description': text('Description', {multiline: true})
        })
      )
    )
  })
}
