import {Infer} from 'alinea'
import Image from 'next/image'
import {ImageBlock} from '../schema/blocks/ImageBlock.js'

export function ImageBlockView({image}: Infer<typeof ImageBlock>) {
  return (
    <Image
      alt={image.title}
      // src={image.src}
      width={image.width}
      height={image.height}
      placeholder="blur"
      blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
    />
  )
}
