import styler from '@alinea/styler'
import type {ImageLink} from 'alinea'
import {imageBlurUrl} from 'alinea/ui'
import NextImage, {
  type ImageProps as NextImageProps,
  type StaticImageData
} from 'next/image'
import css from './Image.module.scss'

const styles = styler(css)

export type ImageProps = Omit<NextImageProps, 'alt'> &
  Pick<ImageLink, 'thumbHash' | 'title'> & {
    fields?: {alt?: string}
    focus?: ImageLink['focus']
  }

export function Image(image: ImageProps) {
  if (!image?.src) return null

  const {className, focus, thumbHash, title, ...props} = image
  const alt = image?.fields?.alt || title || ''
  const blurUrl = imageBlurUrl(image)

  delete (props as any)._entry
  delete (props as any)._id
  delete (props as any)._type
  delete (props as any).averageColor
  delete (props as any).blurHeight
  delete (props as any).blurWidth
  delete (props as any).extension
  delete (props as any).fields
  delete (props as any).filePath
  delete (props as any).hash
  delete (props as any).previewUrl
  delete (props as any).size
  delete (props as any).thumbHash

  return (
    <div className={styles.image(styler.merge({className}))}>
      <NextImage
        {...props}
        alt={alt}
        blurDataURL={blurUrl}
        placeholder={blurUrl ? 'blur' : props.placeholder}
      />
    </div>
  )
}

type StaticImageProps = NextImageProps & StaticImageData
export function StaticImage({
  blurWidth,
  blurHeight,
  blurDataURL,
  ...props
}: StaticImageProps) {
  if (!props.src) return null
  return (
    <div className={styles.image()}>
      <NextImage {...props} blurDataURL={blurDataURL} placeholder="blur" />
    </div>
  )
}
