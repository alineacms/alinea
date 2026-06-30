import {styler} from '@alinea/styler'
import {type HTMLProps, type ReactNode} from 'react'
import css from './Rail.module.css'

const styles = styler(css)

export interface RailProps extends HTMLProps<HTMLDivElement> {
  main?: boolean
}

export function Rail({main, ...props}: RailProps) {
  return <div {...props} className={styles.Rail(styler.merge(props), {main})} />
}

export interface RailHeaderProps extends HTMLProps<HTMLElement> {}

export function RailHeader(props: RailHeaderProps) {
  return (
    <header {...props} className={styles.RailHeader(styler.merge(props))} />
  )
}

export interface RailBodyProps extends HTMLProps<HTMLDivElement> {}

export function RailBody(props: RailBodyProps) {
  return <div {...props} className={styles.RailBody(styler.merge(props))} />
}

export interface RailFooterProps extends HTMLProps<HTMLElement> {}

export function RailFooter(props: RailFooterProps) {
  return (
    <footer {...props} className={styles.RailFooter(styler.merge(props))} />
  )
}

export interface RailContentProps extends HTMLProps<HTMLDivElement> {
  children?: ReactNode
}

export function RailContent(props: RailContentProps) {
  return <div {...props} className={styles.RailContent(styler.merge(props))} />
}
