import type {Infer} from 'alinea'
import Image from 'next/image'
import type {ImageBlock} from './ImageBlock.schema'

type ImageBlockData = Infer.ListItem<typeof ImageBlock>

export function ImageBlockView({block}: {block: ImageBlockData}) {
  if (!block.image) return null

  const {src, width, height} = block.image
  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt={block.alt || ''}
      style={{width: '300px', height: 'auto'}}
    />
  )
}
