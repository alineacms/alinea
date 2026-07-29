'use client'

import styler from '@alinea/styler'
import type {ComponentProps} from 'react'
import css from './ExplorerModal.module.css'
import {RailHeader} from './ui/Rail.js'

const styles = styler(css)

export function ExplorerModal(props: ComponentProps<'div'>) {
  return (
    <div {...props} className={styles.ExplorerModal(styler.merge(props))} />
  )
}

export function ExplorerModalContent(props: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={styles.ExplorerModalContent(styler.merge(props))}
    />
  )
}

export function ExplorerModalNavigation(props: ComponentProps<'aside'>) {
  return (
    <aside
      {...props}
      className={styles.ExplorerModalNavigation(styler.merge(props))}
    />
  )
}

export interface ExplorerModalFooterProps extends ComponentProps<
  typeof RailHeader
> {}

export function ExplorerModalFooter(props: ExplorerModalFooterProps) {
  return (
    <RailHeader
      {...props}
      className={styles.ExplorerModalFooter(styler.merge(props))}
    />
  )
}

export interface ExplorerModalSelectionProps extends ComponentProps<'span'> {}

export function ExplorerModalSelection(props: ExplorerModalSelectionProps) {
  return (
    <span
      {...props}
      className={styles.ExplorerModalSelection(styler.merge(props))}
    />
  )
}

export interface ExplorerModalActionsProps extends ComponentProps<'div'> {}

export function ExplorerModalActions(props: ExplorerModalActionsProps) {
  return (
    <div
      {...props}
      className={styles.ExplorerModalActions(styler.merge(props))}
    />
  )
}
