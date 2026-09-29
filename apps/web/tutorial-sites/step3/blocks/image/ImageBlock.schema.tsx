import {Config, Field} from 'alinea'

export const ImageBlock = Config.type('Image block', {
  fields: {
    image: Field.image('Image', {required: true, width: 0.5}),
    alt: Field.text('Alt text', {width: 0.5})
  }
})
