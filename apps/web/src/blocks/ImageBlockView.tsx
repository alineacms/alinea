import {Infer} from 'alinea'
import {fromModule, imageBlurUrl} from 'alinea/ui'
import Image from 'next/image'
import {ImageBlock} from '../schema/blocks/ImageBlock.js'
import css from './ImageBlockView.module.scss'

const styles = fromModule(css)

export function ImageBlockView({image}: Infer<typeof ImageBlock>) {
  const blurUrl = imageBlurUrl(image)
  return (
    <Image
      className={styles.image()}
      alt={image.title}
      src={image.src}
      width={image.width}
      height={image.height}
      placeholder={blurUrl ? 'blur' : undefined}
      blurDataURL={blurUrl}
    />
  )
}
