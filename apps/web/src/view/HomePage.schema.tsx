import {Schema, type} from '@alinea/core'
import {color} from '@alinea/input.color'
import {link} from '@alinea/input.link'
import {path} from '@alinea/input.path'
import {tab, tabs} from '@alinea/input.tabs'
import {text} from '@alinea/input.text'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundLink} from '@alinea/ui/icons/IcRoundLink'

export const HomePageSchema = type(
  'Home',
  tabs(
    tab('Homepage', {
      title: text('Title', {
        width: 0.5,
        multiline: true
      }),
      path: path('Path', {width: 0.5}),
      headline: text('Headline', {multiline: true}),
      byline: text('Byline', {multiline: true}),
      action: link('Action', {
        fields: type('Fields', {
          label: text('Button label'),
          color: color('Button color', {
            help: 'Make the button pretty',
            initialValue: '#4a63e7'
            //, allowedColors: ['#4a63e7', '#e74a63', '#63e74a']
          })
        })
      })
    }).configure({icon: IcRoundInsertDriveFile}),
    tab('Top navigation', {
      links: link.multiple('Links', {
        type: ['entry', 'external'],
        fields: type('Fields', {
          title: text('Title')
        })
      })
    }).configure({icon: IcRoundLink})
  )
)

export type HomePageSchema = Schema.TypeOf<typeof HomePageSchema>
