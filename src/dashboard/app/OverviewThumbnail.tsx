import {Icon, type IconType} from '#/components.js'
import styler from '@alinea/styler'
import css from './OverviewThumbnail.module.css'

const styles = styler(css)

export interface OverviewThumbnailProps {
  icon: IconType
  /** The color of the icon, eg. of the kind of file */
  iconColor?: string
  /** A preview of the entry's image, shown instead of the icon */
  image?: string
  /** Shown behind the image while it loads, eg. its average color */
  color?: string
}

/** The square before the title of an overview row */
export function OverviewThumbnail({
  icon,
  iconColor,
  image,
  color
}: OverviewThumbnailProps) {
  return (
    <span
      className={styles.OverviewThumbnail()}
      style={image && color ? {background: color} : undefined}
    >
      {image ? (
        <img alt="" src={image} className={styles.OverviewThumbnail.image()} />
      ) : (
        <Icon
          icon={icon}
          className={styles.OverviewThumbnail.icon()}
          style={iconColor ? {color: iconColor} : undefined}
        />
      )}
    </span>
  )
}
