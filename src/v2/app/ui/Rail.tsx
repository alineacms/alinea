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
  return <header className={styles.header(styler.merge(props))} {...props} />
}
