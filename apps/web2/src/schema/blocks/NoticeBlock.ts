import alinea from 'alinea'

export const NoticeBlock = alinea.type('Notice', {
  level: alinea.select(
    'Level',
    {
      info: 'Info',
      warning: 'Warning'
    },
    {initialValue: 'info', width: 0.5, inline: true}
  ),
  body: alinea.richText('Text', {
    inline: true
  })
})
