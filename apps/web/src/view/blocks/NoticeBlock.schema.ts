import {type} from '@alinea/core'
import {richText} from '@alinea/input.richtext'
import {select} from '@alinea/input.select'

export const NoticeBlockSchema = type('Notice', {
  level: select('Level', {
    info: 'Info',
    warning: 'Warning'
  }).configure({initialValue: 'info', width: 0.5, inline: true}),
  body: richText('Text', {
    inline: true
  })
})
