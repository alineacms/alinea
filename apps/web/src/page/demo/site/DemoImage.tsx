import styler from '@alinea/styler'
import type {ImageLink} from 'alinea'
import type {CSSProperties} from 'react'
import css from './DemoImage.module.scss'

const styles = styler(css)

export interface DemoImageProps {
  image: ImageLink | null | undefined
  /** CSS aspect ratio, eg. "4 / 5", omit to fill the parent */
  ratio?: string
  eager?: boolean
  className?: string
}

/** An image cropped around its focus point, with its average color as placeholder */
export function DemoImage({image, ratio, eager, className}: DemoImageProps) {
  const style: CSSProperties = {
    aspectRatio: ratio,
    backgroundColor: image?.averageColor
  }
  return (
    <div className={styles.DemoImage(styler.merge({className}))} style={style}>
      {image?.src && (
        <img
          className={styles.DemoImage.img()}
          src={image.src}
          alt={image.alt ?? ''}
          width={image.width}
          height={image.height}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          style={{
            objectPosition: image.focus
              ? `${image.focus.x * 100}% ${image.focus.y * 100}%`
              : undefined
          }}
        />
      )}
    </div>
  )
}
