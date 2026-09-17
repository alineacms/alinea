import {Config, Field} from 'alinea'

export const GalleryBlock = Config.type('Gallery block', {
  fields: {
    images: Field.image.multiple('Images')
  }
})
