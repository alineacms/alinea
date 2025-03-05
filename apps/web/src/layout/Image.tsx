import styler from '@alinea/styler'
import NextImage, {ImageProps as NextImageProps} from 'next/image'
import css from './Image.module.scss'

const styles = styler(css)

export type ImageProps = Omit<NextImageProps, 'sizes'> & {
  sizes: string
}

export function Image(props: ImageProps) {
  if (!props.src) return null
  return (
    <div className={styles.image(props.layout)}>
      <NextImage priority {...props} {...imageProps(props)} />
    </div>
  )
}

function imageProps(image: ImageProps): Partial<ImageProps> {
  switch (image.layout) {
    case 'fill':
      return {
        objectFit: image.objectFit || 'cover',
        objectPosition: image.objectPosition
      }
    default:
      return {layout: 'responsive'}
  }
}
