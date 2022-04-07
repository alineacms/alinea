import {Media, Reference} from '@alinea/core'
import {Store} from '@alinea/store/Store'
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
        url: page.url,
        alt: page.title
      }))
  }
}

export type ImageBlockProps = Store.TypeOf<ReturnType<typeof imageBlockQuery>>
