import styler from '@alinea/styler'
import type {PropsWithChildren} from 'react'
import css from './Toolbar.module.css'

const styles = styler(css)

export interface ToolbarProps extends PropsWithChildren {
  label: string
  orientation?: 'horizontal' | 'vertical'
}

export function Toolbar({
  children,
  label,
  orientation = 'horizontal'
}: ToolbarProps) {
  return (
    <div
      aria-label={label}
      className={styles['alinea-Toolbar']()}
      data-orientation={orientation}
      role="toolbar"
    >
      {children}
    </div>
  )
}

export function ToolbarGroup({children}: PropsWithChildren) {
  return <div className={styles['alinea-Toolbar-group']()}>{children}</div>
}

export function ToolbarSeparator() {
  return (
    <span aria-hidden="true" className={styles['alinea-Toolbar-separator']()} />
  )
}
