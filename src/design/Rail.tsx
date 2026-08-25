import styler from '@alinea/styler'
import type {CSSProperties, PropsWithChildren} from 'react'
import css from './Rail.module.css'

const styles = styler(css)

export interface RailProps extends PropsWithChildren {
  main?: boolean
  width?: number
}

export function Rail({children, main, width = 280}: RailProps) {
  return (
    <section
      className={styles['alinea-Rail']()}
      data-main={main ? '' : undefined}
      style={{'--alinea-Rail-width': `${width}px`} as CSSProperties}
    >
      {children}
    </section>
  )
}

export function RailHeader({children}: PropsWithChildren) {
  return <header className={styles['alinea-Rail-header']()}>{children}</header>
}

export function RailBody({children}: PropsWithChildren) {
  return <div className={styles['alinea-Rail-body']()}>{children}</div>
}

export function RailContent({children}: PropsWithChildren) {
  return <div className={styles['alinea-Rail-content']()}>{children}</div>
}

export function RailFooter({children}: PropsWithChildren) {
  return <footer className={styles['alinea-Rail-footer']()}>{children}</footer>
}
