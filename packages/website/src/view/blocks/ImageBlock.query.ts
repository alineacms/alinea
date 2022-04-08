import {Media, Reference} from '@alineacms/core'
import {Store} from '@alineacms/store/Store'
import {Pages} from '../../../.alinea/web'
import {ImageBlockSchema} from './ImageBlock.schema'

export async function imageBlockQuery(pages: Pages, block: ImageBlockSchema) {
  const ids = block.image
    .filter((link): link is Reference.Entry => link.type === 'entry')
    .map(link => link.entry)
  return {
    ...block,
    image: await pages
      .findMany(page => page.id.isIn(ids))
      .whereType(Media.File)
      .select(page => ({
        src: page.location,
        alt: page.title,
        blurHash: page.blurHash
      }))
  }
}

export type ImageBlockProps = Store.TypeOf<ReturnType<typeof imageBlockQuery>>
