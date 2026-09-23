import styler from '@alinea/styler'
import type {ReactNode, Ref} from 'react'
import {Heading, type HeadingProps} from './Heading.js'
import css from './Page.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface PageProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/**
 * A full height view in the SidebarInset: a PageHeader, a scrolling
 * PageContent and an optional PageFooter.
 */
export function Page({className, ...props}: PageProps) {
  return (
    <div
      data-slot="page"
      {...props}
      className={styles.Page(styler.merge({className}))}
    />
  )
}

export interface PageHeaderProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/** The bar at the top of the page, holds the PageTitle and PageActions */
export function PageHeader({className, ...props}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      {...props}
      className={styles.PageHeader(styler.merge({className}))}
    />
  )
}

export interface PageTitleProps extends StyleProps, DataProps {
  id?: string
  /** The heading element, defaults to h1 */
  as?: HeadingProps['as']
  children: ReactNode
}

export function PageTitle({as = 'h1', className, ...props}: PageTitleProps) {
  return (
    <Heading
      data-slot="page-title"
      {...props}
      as={as}
      size="xs"
      truncate
      className={styles.PageTitle(styler.merge({className}))}
    />
  )
}

export interface PageActionsProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/** Controls at the end of the PageHeader */
export function PageActions({className, ...props}: PageActionsProps) {
  return (
    <div
      data-slot="page-actions"
      {...props}
      className={styles.PageActions(styler.merge({className}))}
    />
  )
}

export interface PageContentProps extends StyleProps, AriaProps, DataProps {
  /**
   * Centers the children in a column of readable width, as used for forms
   * and documents
   */
  contained?: boolean
  ref?: Ref<HTMLDivElement>
  children?: ReactNode
}

/** The scrolling body of the page */
export function PageContent({
  contained,
  className,
  children,
  ...props
}: PageContentProps) {
  return (
    <div
      data-slot="page-content"
      {...props}
      className={styles.PageContent(styler.merge({className}))}
    >
      {contained ? (
        <div
          data-slot="page-content-container"
          className={styles.PageContent.container()}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export interface PageFooterProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/** A bar pinned to the bottom of the page, eg. for form actions */
export function PageFooter({className, ...props}: PageFooterProps) {
  return (
    <footer
      data-slot="page-footer"
      {...props}
      className={styles.PageFooter(styler.merge({className}))}
    />
  )
}
