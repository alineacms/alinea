import styler from '@alinea/styler'
import NextImage, {
  type ImageProps as NextImageProps,
  type StaticImageData
} from 'next/image'
import css from './Image.module.scss'

const styles = styler(css)

export type ImageProps = NextImageProps & StaticImageData

export function Image({blurWidth, blurHeight, ...props}: ImageProps) {
  if (!props.src) return null
  return (
    <div className={styles.image()}>
      <NextImage {...props} />
    </div>
  )
}
