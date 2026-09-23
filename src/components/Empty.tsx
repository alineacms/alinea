import styler from '@alinea/styler'
import {createElement, type ReactNode} from 'react'
import css from './Empty.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface EmptyProps extends StyleProps, AriaProps, DataProps {
  /** `card` renders the empty state on a raised surface */
  variant?: 'default' | 'card'
  children: ReactNode
}

/**
 * A placeholder for a view without content: an EmptyHeader with media, title
 * and description, followed by optional EmptyContent with actions.
 */
export function Empty({variant = 'default', className, ...props}: EmptyProps) {
  return (
    <div
      data-slot="empty"
      {...props}
      data-variant={variant}
      className={styles.Empty(styler.merge({className}))}
    />
  )
}

export interface EmptyHeaderProps extends StyleProps, DataProps {
  children: ReactNode
}

export function EmptyHeader({className, ...props}: EmptyHeaderProps) {
  return (
    <div
      data-slot="empty-header"
      {...props}
      className={styles.EmptyHeader(styler.merge({className}))}
    />
  )
}

export interface EmptyMediaProps extends StyleProps, DataProps {
  /** `icon` places the icon on a muted tile */
  variant?: 'default' | 'icon'
  children: ReactNode
}

/** An icon or illustration above the title */
export function EmptyMedia({
  variant = 'default',
  className,
  ...props
}: EmptyMediaProps) {
  return (
    <div
      data-slot="empty-media"
      aria-hidden
      {...props}
      data-variant={variant}
      className={styles.EmptyMedia(styler.merge({className}))}
    />
  )
}

export interface EmptyTitleProps extends StyleProps, DataProps {
  id?: string
  /** The element to render, use a heading when the empty state is the page */
  as?: 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  children: ReactNode
}

export function EmptyTitle({as = 'div', className, ...props}: EmptyTitleProps) {
  return createElement(as, {
    'data-slot': 'empty-title',
    ...props,
    className: styles.EmptyTitle(styler.merge({className}))
  })
}

export interface EmptyDescriptionProps extends StyleProps, DataProps {
  id?: string
  children: ReactNode
}

export function EmptyDescription({className, ...props}: EmptyDescriptionProps) {
  return (
    <div
      data-slot="empty-description"
      {...props}
      className={styles.EmptyDescription(styler.merge({className}))}
    />
  )
}

export interface EmptyContentProps extends StyleProps, DataProps {
  children: ReactNode
}

/** Actions or further content below the header */
export function EmptyContent({className, ...props}: EmptyContentProps) {
  return (
    <div
      data-slot="empty-content"
      {...props}
      className={styles.EmptyContent(styler.merge({className}))}
    />
  )
}
