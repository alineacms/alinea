import {Schema, type} from '@alinea/core'
import {link} from '@alinea/input.link'

export const ImageBlockSchema = type('Image', {
  image: link.image('Link', {type: 'image', inline: true})
})

export type ImageBlockSchema = Schema.TypeOf<typeof ImageBlockSchema>

/*export function queryImageBlock(Entry: Collection<ImageBlockSchema>) {
  return {
    images: Entry.where(Entry.id.isIn(
      Entry.image.i
    ))
  }
}
*/
