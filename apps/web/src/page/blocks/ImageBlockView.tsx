import styler from '@alinea/styler'
import type {ImageLink, Infer} from 'alinea'
import {imageBlurUrl} from 'alinea/ui'
import Image from 'next/image'
import type {ImageBlock} from '@/schema/blocks/ImageBlock'
import css from './ImageBlockView.module.scss'

const styles = styler(css)

export interface ImageBlockViewProps extends Infer<typeof ImageBlock> {}

interface ImageBlockImageProps {
  image: ImageLink
  variant?: 'light' | 'dark'
}

function ImageBlockImage({image, variant}: ImageBlockImageProps) {
  const blurUrl = imageBlurUrl(image)
  return (
    <Image
      className={styles.ImageBlockView.image({
        light: variant === 'light',
        dark: variant === 'dark'
      })}
      alt={image.title}
      src={image.src}
      // Images are uploaded at twice their display size
      style={{maxWidth: image.width * 0.5}}
      sizes="(min-width: 1200px) 960px, 100vw"
      width={image.width}
      height={image.height}
      placeholder={blurUrl ? 'blur' : undefined}
      blurDataURL={blurUrl}
    />
  )
}

export function ImageBlockView({
  image,
  darkImage,
  caption
}: ImageBlockViewProps) {
  if (!image.src) return null
  const hasDark = Boolean(darkImage?.src)
  return (
    <figure className={styles.ImageBlockView()}>
      <ImageBlockImage image={image} variant={hasDark ? 'light' : undefined} />
      {hasDark && <ImageBlockImage image={darkImage} variant="dark" />}
      {caption && (
        <figcaption className={styles.ImageBlockView.caption()}>
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
