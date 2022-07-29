import NextImage, {ImageProps} from 'next/image'
import {CSSProperties, Fragment} from 'react'

import {fromModule} from '@alinea/ui'
import css from './Image.module.scss'

const styles = fromModule(css)

declare type ImgElementStyle = NonNullable<
  JSX.IntrinsicElements['img']['style']
>

export function Image({
  layout,
  sizes,
  priority = false,
  objectFit,
  objectPosition,
  className,
  onLoadingComplete = () => {},
  ...image
}: ImageProps & {
  sizes: string
  objectFit?: 'cover' | ImgElementStyle['objectFit']
  objectPosition?: ImgElementStyle['objectPosition']
  className?: string
}) {
  if (!image?.src) return null
  const BackgroundTag = layout === 'fill' ? 'div' : Fragment
  const backgroundProps =
    layout === 'fill'
      ? ({style: {position: 'absolute', inset: 0}} as CSSProperties)
      : ({} as any)

  return (
    <BackgroundTag {...backgroundProps}>
      <div className={styles.root.with(className)(layout)}>
        <NextImage
          sizes={sizes}
          priority={priority}
          {...switchProps(image, layout, objectFit, objectPosition)}
          src={image.src}
          alt={image?.alt || image?.title}
          onLoadingComplete={onLoadingComplete}
        />
      </div>
    </BackgroundTag>
  )
}

export const getImageRatio = (image: any, width: number) => {
  if (image.height > image.width) return (image.height / image.width) * width
  return width / (image.width / image.height)
}

const switchProps = (
  image: any,
  layout?: 'fill' | 'responsive' | 'fixed' | 'intrinsic',
  objectFit?: 'cover' | ImgElementStyle['objectFit'],
  objectPosition?: ImgElementStyle['objectPosition']
) => {
  if (layout === 'responsive' && image?.width && !image?.height)
    image.height = getImageRatio(image, image?.width)

  const focus = image?.focus
    ? `${image.focus?.x * 100}% ${image.focus?.y * 100}%`
    : 'center center'

  switch (layout) {
    case 'responsive':
      return {layout: 'responsive', width: image?.width, height: image?.height}

    case 'fill':
      return {
        layout: 'fill',
        objectFit: objectFit || 'cover',
        objectPosition: objectPosition || focus
      }

    default:
      return {...image}
  }
}
