import type {ImageEdit} from '#/core/media/ImageEdit.js'
import {rotatedSize} from '#/core/media/ImageEdit.js'
import styler from '@alinea/styler'
import type {CSSProperties} from 'react'
import css from './CroppedImage.module.css'

const styles = styler(css)

export interface CroppedImageProps {
  src: string
  /** Dimensions of the image as the browser shows it */
  width: number
  height: number
  /** The rotation and crop to show, without one the whole image shows */
  edit?: ImageEdit
  className?: string
  style?: CSSProperties
}

/**
 * Shows an image rotated and cropped with css, the way editImage encodes it.
 * The element takes the aspect ratio of the crop, size it with css.
 */
export function CroppedImage({
  src,
  width,
  height,
  edit,
  className,
  style
}: CroppedImageProps) {
  const rotate = edit?.rotate ?? 0
  const crop = edit?.crop ?? {x: 0, y: 0, width: 1, height: 1}
  const rotated = rotatedSize(width, height, rotate)
  const sideways = rotate % 180 !== 0
  return (
    <span
      className={styles.CroppedImage(styler.merge({className}))}
      style={{
        aspectRatio: `${crop.width * rotated.width} / ${crop.height * rotated.height}`,
        ...style
      }}
    >
      <span
        className={styles.CroppedImage.frame()}
        style={{
          left: `${(-crop.x / crop.width) * 100}%`,
          top: `${(-crop.y / crop.height) * 100}%`,
          width: `${100 / crop.width}%`,
          height: `${100 / crop.height}%`
        }}
      >
        <img
          alt=""
          draggable={false}
          src={src}
          className={styles.CroppedImage.image()}
          style={{
            // Sideways images swap their width and height inside the frame
            width: sideways
              ? `${(rotated.height / rotated.width) * 100}%`
              : '100%',
            height: sideways
              ? `${(rotated.width / rotated.height) * 100}%`
              : '100%',
            transform: `translate(-50%, -50%) rotate(${rotate}deg)`
          }}
        />
      </span>
    </span>
  )
}
