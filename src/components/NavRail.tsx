import styler from '@alinea/styler'
import type {MouseEvent, ReactNode} from 'react'
import {Icon} from './Icon.js'
import css from './NavRail.module.css'
import {Tooltip, TooltipContent, TooltipTrigger} from './Tooltip.js'
import type {AriaProps, DataProps, IconType, StyleProps} from './types.js'

const styles = styler(css)

export interface NavRailProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/**
 * A narrow vertical bar of icon buttons at the edge of the AppShell, for
 * switching between the main sections of the application. It turns into a
 * horizontal bar on small screens.
 */
export function NavRail({className, ...props}: NavRailProps) {
  return (
    <aside
      data-slot="nav-rail"
      {...props}
      className={styles.NavRail(styler.merge({className}))}
    />
  )
}

export interface NavRailHeaderProps extends StyleProps, DataProps {
  children: ReactNode
}

/** The top of the rail, eg. a logo or workspace switcher */
export function NavRailHeader({className, ...props}: NavRailHeaderProps) {
  return (
    <div
      data-slot="nav-rail-header"
      {...props}
      className={styles.NavRailHeader(styler.merge({className}))}
    />
  )
}

export interface NavRailContentProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/** The navigation items of the rail */
export function NavRailContent({className, ...props}: NavRailContentProps) {
  return (
    <nav
      data-slot="nav-rail-content"
      {...props}
      className={styles.NavRailContent(styler.merge({className}))}
    />
  )
}

export interface NavRailItemProps extends StyleProps, DataProps {
  icon: IconType
  /** Shown in a tooltip and used as the accessible name */
  label: string
  /** Marks the item as the current section */
  active?: boolean
  /** Renders the item as a link */
  href?: string
  disabled?: boolean
  /** A count or `true` for a dot, shown on top of the icon */
  badge?: ReactNode
  onClick?: (event: MouseEvent<HTMLElement>) => void
}

/** An icon button in the rail with its label in a tooltip */
export function NavRailItem({
  icon,
  label,
  active,
  href,
  disabled,
  badge,
  className,
  onClick,
  ...props
}: NavRailItemProps) {
  const attributes = {
    'data-slot': 'nav-rail-item',
    ...props,
    'aria-label': label,
    'aria-current': active ? ('page' as const) : undefined,
    className: styles.NavRailItem(styler.merge({className})),
    onClick
  }
  const content = (
    <>
      <Icon icon={icon} className={styles.NavRailItem.icon()} />
      {badge !== undefined && badge !== false && badge !== null && (
        <span
          data-slot="nav-rail-item-badge"
          data-dot={badge === true || undefined}
          aria-hidden
          className={styles.NavRailItem.badge()}
        >
          {badge === true ? null : badge}
        </span>
      )}
    </>
  )
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        {href && !disabled ? (
          <a {...attributes} href={href}>
            {content}
          </a>
        ) : href ? (
          <a {...attributes} aria-disabled>
            {content}
          </a>
        ) : (
          <button {...attributes} type="button" disabled={disabled}>
            {content}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export interface NavRailFooterProps extends StyleProps, DataProps {
  children: ReactNode
}

/** Pinned to the end of the rail, eg. activity and the user menu */
export function NavRailFooter({className, ...props}: NavRailFooterProps) {
  return (
    <div
      data-slot="nav-rail-footer"
      {...props}
      className={styles.NavRailFooter(styler.merge({className}))}
    />
  )
}
