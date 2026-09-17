import {ImageBlock} from '@/schema/blocks/ImageBlock'
import styler from '@alinea/styler'
import {Infer} from 'alinea'
import {imageBlurUrl} from 'alinea/ui'
import Image from 'next/image'
import css from './ImageBlockView.module.scss'

const styles = styler(css)

export function ImageBlockView({image}: Infer<typeof ImageBlock>) {
  const blurUrl = imageBlurUrl(image)
  if (!image.src) return null
  return (
    <Image
      className={styles.image()}
      alt={image.title}
      src={image.src}
      style={{maxWidth: image.width * 0.5}}
      sizes="(min-width: 1200px) 960px, 100vw"
      width={image.width}
      height={image.height}
      placeholder={blurUrl ? 'blur' : undefined}
      blurDataURL={blurUrl}
    />
  )
}
