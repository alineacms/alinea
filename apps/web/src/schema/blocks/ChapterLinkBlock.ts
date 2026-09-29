import {Config, Field} from 'alinea'

export const ChapterLinkBlock = Config.type('Chapter link', {
  fields: {
    link: Field.entry('Link', {
      inline: true,
      fields: {
        description: Field.text('Description', {multiline: true})
      }
    })
  }
})
