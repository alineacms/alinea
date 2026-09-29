import {Config, Field} from 'alinea'

export const NoticeBlock = Config.type('Notice', {
  fields: {
    level: Field.select('Level', {
      initialValue: 'info',
      width: 0.5,
      inline: true,
      options: {
        info: 'Info',
        warning: 'Warning'
      }
    }),
    body: Field.richText('Text', {
      inline: true
    })
  }
})
