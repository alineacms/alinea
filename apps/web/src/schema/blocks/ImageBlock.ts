import {Config, Field} from 'alinea'

export const ImageBlock = Config.type('Image', {
  fields: {
    image: Field.image('Link', {inline: true, width: 0.5}),
    darkImage: Field.image('Dark image', {
      inline: true,
      width: 0.5,
      help: 'Optional, shown instead when the site uses its dark theme'
    }),
    caption: Field.text('Caption')
  }
})
