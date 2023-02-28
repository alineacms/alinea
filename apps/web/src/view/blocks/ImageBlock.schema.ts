import {type} from 'alinea/core'
import {link} from 'alinea/input/link'

export const ImageBlockSchema = type('Image', {
  image: link.image('Link', {inline: true})
})
