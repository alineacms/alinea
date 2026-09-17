import type {Infer} from 'alinea'
import {GalleryBlockView} from '@/blocks/gallery/GalleryBlock'
import {ImageBlockView} from '@/blocks/image/ImageBlock'
import {TextBlockView} from '@/blocks/text/TextBlock'
import {Page} from './Page.schema'

type PageData = Infer.Entry<typeof Page>

export function PageView({page}: {page: PageData}) {
  return (
    <main>
      <h1>{page.title}</h1>
      {page.blocks.map(block => {
        if (block._type === 'TextBlock') return <TextBlockView key={block._id} block={block} />
        if (block._type === 'ImageBlock') return <ImageBlockView key={block._id} block={block} />
        if (block._type === 'GalleryBlock') return <GalleryBlockView key={block._id} block={block} />
        return null
      })}
    </main>
  )
}
