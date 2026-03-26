import {styler} from '@alinea/styler'
import {HTMLProps} from 'react'
import css from './Rail.module.scss'

const styles = styler(css)

export interface RailProps extends HTMLProps<HTMLDivElement> {
  main?: boolean
}

export function Rail({main, ...props}: RailProps) {
  return <div {...props} className={styles.root(styler.merge(props), {main})} />
}

export interface RailHeaderProps extends HTMLProps<HTMLElement> {}

export function RailHeader(props: RailHeaderProps) {
  return <header {...props} className={styles.header(styler.merge(props))} />
}

export interface RailBodyProps extends HTMLProps<HTMLDivElement> {}

export function RailBody(props: RailBodyProps) {
  return <div {...props} className={styles.body(styler.merge(props))} />
}

export interface RailFooterProps extends HTMLProps<HTMLElement> {}

export function RailFooter(props: RailFooterProps) {
  return <footer {...props} className={styles.footer(styler.merge(props))} />
}
