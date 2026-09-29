import styler from '@alinea/styler'
import type {ImageLink} from 'alinea'
import {imageBlurUrl} from 'alinea/ui'
import type {CSSProperties} from 'react'
import NextImage from 'next/image'
import css from './Image.module.scss'

const styles = styler(css)

/** Renders an image link, eg. `<Image {...image} />` */
export interface ImageProps extends Pick<
  ImageLink,
  'src' | 'width' | 'height' | 'thumbHash' | 'title'
> {
  fields?: {alt?: string}
  className?: string
  style?: CSSProperties
  unoptimized?: boolean
}

export function Image({
  src,
  width,
  height,
  thumbHash,
  title,
  fields,
  className,
  style,
  unoptimized
}: ImageProps) {
  if (!src) return null
  const blurUrl = imageBlurUrl({thumbHash})
  return (
    <div className={styles.image(styler.merge({className}))}>
      <NextImage
        src={src}
        width={width}
        height={height}
        style={style}
        unoptimized={unoptimized}
        alt={fields?.alt || title || ''}
        blurDataURL={blurUrl}
        placeholder={blurUrl ? 'blur' : undefined}
      />
    </div>
  )
}
