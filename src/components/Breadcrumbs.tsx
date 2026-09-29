import styler from '@alinea/styler'
import type {MouseEvent, ReactNode} from 'react'
import {IcRoundChevronRight, IcRoundMoreHoriz} from '#/dashboard/icons.js'
import css from './Breadcrumbs.module.css'
import {Slot, type SlotProps} from './internal/Slot.js'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface BreadcrumbProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/** Navigation landmark that shows the path to the current page */
export function Breadcrumb({
  'aria-label': ariaLabel = 'Breadcrumb',
  ...props
}: BreadcrumbProps) {
  return <nav data-slot="breadcrumb" aria-label={ariaLabel} {...props} />
}

export interface BreadcrumbListProps extends StyleProps, DataProps {
  children: ReactNode
}

export function BreadcrumbList({className, ...props}: BreadcrumbListProps) {
  return (
    <ol
      data-slot="breadcrumb-list"
      {...props}
      className={styles.BreadcrumbList(styler.merge({className}))}
    />
  )
}

export interface BreadcrumbItemProps extends StyleProps, DataProps {
  children: ReactNode
}

export function BreadcrumbItem({className, ...props}: BreadcrumbItemProps) {
  return (
    <li
      data-slot="breadcrumb-item"
      {...props}
      className={styles.BreadcrumbItem(styler.merge({className}))}
    />
  )
}

export interface BreadcrumbLinkProps extends StyleProps, AriaProps, DataProps {
  href?: string
  target?: string
  rel?: string
  /** Merge the link styling onto the single child element */
  asChild?: boolean
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  children: ReactNode
}

export function BreadcrumbLink({
  asChild,
  className,
  onClick,
  children,
  ...props
}: BreadcrumbLinkProps) {
  const attributes = {
    'data-slot': 'breadcrumb-link',
    ...props,
    className: styles.BreadcrumbLink(styler.merge({className}))
  }
  if (asChild)
    return (
      <Slot {...attributes} onClick={onClick as SlotProps['onClick']}>
        {children}
      </Slot>
    )
  return (
    <a {...attributes} onClick={onClick}>
      {children}
    </a>
  )
}

export interface BreadcrumbPageProps extends StyleProps, DataProps {
  children: ReactNode
}

/** The current page, the last item of the list */
export function BreadcrumbPage({className, ...props}: BreadcrumbPageProps) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      {...props}
      className={styles.BreadcrumbPage(styler.merge({className}))}
    />
  )
}

export interface BreadcrumbSeparatorProps extends StyleProps, DataProps {
  /** Replaces the default chevron */
  children?: ReactNode
}

export function BreadcrumbSeparator({
  className,
  children,
  ...props
}: BreadcrumbSeparatorProps) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      {...props}
      className={styles.BreadcrumbSeparator(styler.merge({className}))}
    >
      {children ?? (
        <IcRoundChevronRight className={styles.BreadcrumbSeparator.icon()} />
      )}
    </li>
  )
}

export interface BreadcrumbEllipsisProps extends StyleProps, DataProps {}

/** Stands in for collapsed items */
export function BreadcrumbEllipsis({
  className,
  ...props
}: BreadcrumbEllipsisProps) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      {...props}
      className={styles.BreadcrumbEllipsis(styler.merge({className}))}
    >
      <IcRoundMoreHoriz className={styles.BreadcrumbEllipsis.icon()} />
      <span className={styles.BreadcrumbEllipsis.label()}>More</span>
    </span>
  )
}
