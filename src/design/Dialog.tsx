import styler from '@alinea/styler'
import type {HTMLAttributes, PropsWithChildren} from 'react'
import css from './Dialog.module.css'

const styles = styler(css)

export interface DialogOverlayProps extends PropsWithChildren {
  entering?: boolean
  mode?: 'preview' | 'viewport'
}

export function DialogOverlay({
  children,
  entering,
  mode = 'viewport'
}: DialogOverlayProps) {
  return (
    <div
      className={styles['alinea-Dialog-overlay']()}
      data-entering={entering ? '' : undefined}
      data-mode={mode}
    >
      {children}
    </div>
  )
}

export interface DialogProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'className'
> {
  entering?: boolean
}

export function Dialog({children, entering, ...props}: DialogProps) {
  return (
    <div
      {...props}
      aria-modal="true"
      className={styles['alinea-Dialog']()}
      data-entering={entering ? '' : undefined}
      role="dialog"
    >
      {children}
    </div>
  )
}

export function DialogHeader({children}: PropsWithChildren) {
  return <div className={styles['alinea-Dialog-header']()}>{children}</div>
}

export function DialogHeading({children}: PropsWithChildren) {
  return <div className={styles['alinea-Dialog-heading']()}>{children}</div>
}

export function DialogTitle({children}: PropsWithChildren) {
  return <h2 className={styles['alinea-Dialog-title']()}>{children}</h2>
}

export function DialogDescription({children}: PropsWithChildren) {
  return <p className={styles['alinea-Dialog-description']()}>{children}</p>
}

export function DialogContent({children}: PropsWithChildren) {
  return <div className={styles['alinea-Dialog-content']()}>{children}</div>
}

export function DialogFooter({children}: PropsWithChildren) {
  return <div className={styles['alinea-Dialog-footer']()}>{children}</div>
}
