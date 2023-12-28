import {ImageBlock} from '@/schema/blocks/ImageBlock'
import {Infer} from 'alinea'
import {fromModule, imageBlurUrl} from 'alinea/ui'
import Image from 'next/image'
import css from './ImageBlockView.module.scss'

const styles = fromModule(css)

export function ImageBlockView({image}: Infer<typeof ImageBlock>) {
  const blurUrl = imageBlurUrl(image)
  if (!image.src) return null
  return (
    <Image
      className={styles.image()}
      alt={image.title}
      src={image.src}
      sizes="(min-width: 1200px) 960px, 100vw"
      width={image.width}
      height={image.height}
      placeholder={blurUrl ? 'blur' : undefined}
      blurDataURL={blurUrl}
    />
  )
}
