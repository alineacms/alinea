import styler from '@alinea/styler'
import type {CSSProperties, PropsWithChildren} from 'react'
import css from './Preview.module.css'

const styles = styler(css)

interface PreviewLayoutProps extends PropsWithChildren {
  columns?: number
  gap?: 'small' | 'medium' | 'large'
}

const gaps = {
  small: 'var(--alinea-space-2)',
  medium: 'var(--alinea-space-3)',
  large: 'var(--alinea-space-4)'
}

function layoutStyle({columns, gap}: PreviewLayoutProps): CSSProperties {
  return {
    '--alinea-Preview-columns': columns,
    '--alinea-Preview-gap': gap ? gaps[gap] : undefined
  } as CSSProperties
}

export function PreviewStack(props: PreviewLayoutProps) {
  return (
    <div
      className={styles['alinea-Preview-stack']()}
      style={layoutStyle(props)}
    >
      {props.children}
    </div>
  )
}

export function PreviewRow(props: PreviewLayoutProps) {
  return (
    <div className={styles['alinea-Preview-row']()} style={layoutStyle(props)}>
      {props.children}
    </div>
  )
}

export function PreviewGrid(props: PreviewLayoutProps) {
  return (
    <div className={styles['alinea-Preview-grid']()} style={layoutStyle(props)}>
      {props.children}
    </div>
  )
}

export function PreviewCaption({children}: PropsWithChildren) {
  return <p className={styles['alinea-Preview-caption']()}>{children}</p>
}

export function PreviewIcon({children}: PropsWithChildren) {
  return <span className={styles['alinea-Preview-icon']()}>{children}</span>
}
