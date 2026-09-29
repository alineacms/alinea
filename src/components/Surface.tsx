import styler from '@alinea/styler'
import type {ComponentPropsWithoutRef} from 'react'
import css from './Surface.module.css'

const styles = styler(css)

export interface SurfaceProps extends ComponentPropsWithoutRef<'div'> {
  depth?: 'base' | 'muted'
  variant?: 'base' | 'muted'
}

export function Surface({className, depth, variant, ...props}: SurfaceProps) {
  return (
    <div
      data-slot="surface"
      {...props}
      className={styles.Surface(styler.merge({className}))}
      data-depth={depth ?? variant}
    />
  )
}

export interface SurfaceHeaderProps extends ComponentPropsWithoutRef<'header'> {}

export function SurfaceHeader({className, ...props}: SurfaceHeaderProps) {
  return (
    <header
      data-slot="surface-header"
      {...props}
      className={styles.SurfaceHeader(styler.merge({className}))}
    />
  )
}

export interface SurfaceContentProps extends ComponentPropsWithoutRef<'div'> {}

export function SurfaceContent({className, ...props}: SurfaceContentProps) {
  return (
    <div
      data-slot="surface-content"
      {...props}
      className={styles.SurfaceContent(styler.merge({className}))}
    />
  )
}

export interface SurfaceRowProps extends ComponentPropsWithoutRef<'div'> {}

export function SurfaceRow({className, ...props}: SurfaceRowProps) {
  return (
    <div
      data-slot="surface-row"
      {...props}
      className={styles.SurfaceRow(styler.merge({className}))}
    />
  )
}
