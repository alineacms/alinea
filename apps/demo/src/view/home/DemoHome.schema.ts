import {type} from 'alinea/core'
import {link} from 'alinea/input/link'
import {object} from 'alinea/input/object'
import {path} from 'alinea/input/path'
import {richText} from 'alinea/input/richtext'
import {text} from 'alinea/input/text'

export const DemoHomeSchema = type('Home', {
  title: text('Title', {width: 0.5, multiline: true}),
  path: path('Path', {width: 0.5}),
  hero: object('Header', {
    fields: type('Fields', {
      header: object('Image', {
        fields: type('Image fields', {
          image: link.image('Image', {inline: true}),
          credit: richText('Credit')
        })
      }),
      title: text('Title', {multiline: true}),
      text: richText('Text')
    })
  })
})
