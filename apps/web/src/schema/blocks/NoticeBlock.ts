import alinea from 'alinea'

export const NoticeBlock = alinea.type('Notice', {
  level: alinea.select('Level', {
    initialValue: 'info',
    width: 0.5,
    inline: true,
    options: {
      info: 'Info',
      warning: 'Warning'
    }
  }),
  body: alinea.richText('Text', {
    inline: true
  })
})
