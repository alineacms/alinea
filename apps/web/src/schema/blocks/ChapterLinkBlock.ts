import alinea from 'alinea'

export const ChapterLinkBlock = alinea.type('Chapter link', {
  link: alinea.entry('Link', {
    fields: alinea.type('Link fields', {
      description: alinea.text('Description', {multiline: true})
    }),
    inline: true
  })
})
