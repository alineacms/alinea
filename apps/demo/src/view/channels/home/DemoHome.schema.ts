import {Schema, schema, type} from '@alinea/core'
import {link} from '@alinea/input.link'
import {list} from '@alinea/input.list'
import {object} from '@alinea/input.object'
import {path} from '@alinea/input.path'
import {richText} from '@alinea/input.richtext'
import {tab, tabs} from '@alinea/input.tabs'
import {text} from '@alinea/input.text'

export const DemoHomeSchema = type(
  'Home',
  tabs(
    tab('Homepage', {
      title: text('Title', {width: 0.5, multiline: true}),
      path: path('Path', {width: 0.5}),
      hero: object('Hero', {
        fields: type('Fields', {
          image: link.image('Image', {
            type: 'image'
          }),
          title: text('Title'),
          text: richText('Text'),
          button: link('Button', {type: ['entry', 'external']})
        })
      })
    }),
    tab('Header', {
      links: link.multiple('Links', {
        type: ['entry', 'external'],
        fields: type('Fields', {
          label: text('Label'),
          active: text('Active url', {help: 'Active when this url is active'})
        })
      })
    }),
    tab('Footer', {
      footer: list('Navigation', {
        schema: schema({
          Section: type('Section', {
            label: text('Label'),
            links: link.multiple('Links', {
              type: ['entry', 'external'],
              fields: type('Fields', {
                label: text('Label')
              })
            })
          })
        })
      })
    })
  )
)

export type DemoHomeSchema = Schema.TypeOf<typeof DemoHomeSchema>
