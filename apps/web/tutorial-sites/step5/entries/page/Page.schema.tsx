import {Config, Field} from 'alinea'
import {GalleryBlock} from '@/blocks/gallery/GalleryBlock.schema'
import {ImageBlock} from '@/blocks/image/ImageBlock.schema'
import {TextBlock} from '@/blocks/text/TextBlock.schema'

export const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {
    title: Field.text('Title', {required: true, width: 0.5}),
    path: Field.path('Path', {required: true, width: 0.5}),
    blocks: Field.list('Blocks', {
      schema: {
        TextBlock,
        ImageBlock,
        GalleryBlock
      }
    })
  }
})
