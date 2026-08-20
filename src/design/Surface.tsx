import styler from '@alinea/styler'
import type {HTMLAttributes, PropsWithChildren} from 'react'
import css from './Surface.module.css'

const styles = styler(css)

export interface SurfaceProps
  extends PropsWithChildren, Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  depth?: 'base' | 'muted'
}

export function Surface({children, depth, ...props}: SurfaceProps) {
  return (
    <div {...props} className={styles['alinea-Surface']()} data-depth={depth}>
      {children}
    </div>
  )
}

export function SurfaceHeader({children}: PropsWithChildren) {
  return <div className={styles['alinea-Surface-header']()}>{children}</div>
}

export function SurfaceTitle({children}: PropsWithChildren) {
  return <h3 className={styles['alinea-Surface-title']()}>{children}</h3>
}

export function SurfaceContent({children}: PropsWithChildren) {
  return <div className={styles['alinea-Surface-content']()}>{children}</div>
}

export function SurfaceFooter({children}: PropsWithChildren) {
  return <div className={styles['alinea-Surface-footer']()}>{children}</div>
}
