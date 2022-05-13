import {Schema, type} from '@alinea/core'
import {tab, tabs} from '@alinea/input.tabs'

import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundLink} from '@alinea/ui/icons/IcRoundLink'
import {link} from '@alinea/input.link'
import {path} from '@alinea/input.path'
import {text} from '@alinea/input.text'

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
          label: text('Button label')
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
