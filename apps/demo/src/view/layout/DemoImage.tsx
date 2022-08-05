import {fromModule} from '@alinea/ui'
import NextImage, {ImageProps as NextImageProps} from 'next/image'
import css from './DemoImage.module.scss'

const styles = fromModule(css)

type ImageProps = Omit<NextImageProps, 'sizes'> & {
  sizes: string
}

export function DemoImage(props: ImageProps) {
  if (!props.src) return null

  return (
    <div className={styles.root.with(props.className)(props.layout)}>
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
