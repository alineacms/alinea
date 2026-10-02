import styler from '@alinea/styler'
import {Fragment, type ReactNode} from 'react'
import {
  IcRoundInsertDriveFile,
  IcRoundKeyboardArrowRight
} from '#/dashboard/icons.js'
import css from './ContentCard.module.css'
import {Icon} from './Icon.js'
import type {IconType, StyleProps} from './types.js'

const styles = styler(css)

export interface ContentCardProps extends StyleProps {
  title: ReactNode
  /**
   * `icon` (the default) shows the icon on a neutral background, `media`
   * previews a file: its image on the `color` placeholder, or a file icon
   */
  variant?: 'icon' | 'media'
  /** The large icon on top of the card */
  icon?: IconType
  /** The color of the icon, eg. of the kind of file */
  iconColor?: string
  /** Preview image of a media card */
  image?: string
  /** Placeholder color behind the image, eg. its average color */
  color?: string
  /** The location of the item, rendered above the title */
  breadcrumbs?: ReadonlyArray<ReactNode>
  /** A line below the title, eg. the type or file extension */
  description?: ReactNode
  /** Rendered at the end of the description, eg. dimensions and file size */
  details?: ReactNode
}

/** The contents of a ContentGridItem, mirroring the dashboard explorer cards */
export function ContentCard({
  title,
  variant = 'icon',
  icon,
  iconColor,
  image,
  color,
  breadcrumbs,
  description,
  details,
  className,
  style
}: ContentCardProps) {
  const hasBreadcrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0)
  return (
    <div
      data-slot="content-card"
      data-variant={variant}
      className={styles.ContentCard(styler.merge({className}))}
      style={style}
    >
      <div
        data-slot="content-card-media"
        className={styles.ContentCard.media()}
        style={{backgroundColor: color || undefined}}
      >
        {image ? (
          <img
            data-slot="content-card-image"
            src={image}
            alt=""
            className={styles.ContentCard.image()}
          />
        ) : (
          (icon || variant === 'media') && (
            <Icon
              data-slot="content-card-icon"
              icon={icon ?? IcRoundInsertDriveFile}
              className={styles.ContentCard.icon()}
              style={{color: iconColor}}
            />
          )
        )}
      </div>
      <div data-slot="content-card-body" className={styles.ContentCard.body()}>
        {hasBreadcrumbs && (
          <div
            data-slot="content-card-breadcrumbs"
            className={styles.ContentCard.breadcrumbs()}
          >
            {breadcrumbs!.map((breadcrumb, index) => (
              <Fragment key={index}>
                {index > 0 && (
                  <IcRoundKeyboardArrowRight
                    aria-hidden
                    data-slot="content-card-separator"
                    className={styles.ContentCard.breadcrumbs.separator()}
                  />
                )}
                {breadcrumb}
              </Fragment>
            ))}
          </div>
        )}
        <div
          data-slot="content-card-title"
          className={styles.ContentCard.title()}
        >
          {title}
        </div>
        {(description || details) && (
          <div
            data-slot="content-card-description"
            className={styles.ContentCard.description()}
          >
            {description && (
              <span className={styles.ContentCard.description.text()}>
                {description}
              </span>
            )}
            {details && (
              <span className={styles.ContentCard.details()}>{details}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export interface ContentCardSkeletonProps extends StyleProps {}

/** A pulsing placeholder card for items that are still loading */
export function ContentCardSkeleton({
  className,
  style
}: ContentCardSkeletonProps) {
  return (
    <div
      data-slot="content-card-skeleton"
      aria-hidden
      className={styles.ContentCard(
        {skeleton: true},
        styler.merge({className})
      )}
      style={style}
    >
      <div
        data-slot="content-card-media"
        className={styles.ContentCard.media()}
      >
        <div
          data-slot="content-card-skeleton-icon"
          className={styles.ContentCard.skeleton({icon: true})}
        />
      </div>
      <div data-slot="content-card-body" className={styles.ContentCard.body()}>
        <div
          data-slot="content-card-skeleton-line"
          className={styles.ContentCard.skeleton({wide: true})}
        />
        <div
          data-slot="content-card-skeleton-line"
          className={styles.ContentCard.skeleton()}
        />
      </div>
    </div>
  )
}
