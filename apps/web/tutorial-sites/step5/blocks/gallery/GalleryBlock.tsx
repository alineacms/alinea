import type {Infer} from 'alinea'
import Image from 'next/image'
import type {GalleryBlock} from './GalleryBlock.schema'

type GalleryBlockData = Infer.ListItem<typeof GalleryBlock>

export function GalleryBlockView({block}: {block: GalleryBlockData}) {
  return (
    <ul>
      {block.images.map((image, index) => {
        const src = typeof image === 'string' ? image : image?.src || ''
        const width = typeof image === 'string' ? 800 : image?.width || 800
        const height = typeof image === 'string' ? 600 : image?.height || 600

        return src ? (
          <li key={`${src}-${index}`}>
            <Image src={src} alt="" width={width} height={height} style={{height: 'auto'}} />
          </li>
        ) : null
      })}
    </ul>
  )
}
