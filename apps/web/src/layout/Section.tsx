import styler from '@alinea/styler'
import type {HTMLAttributes} from 'react'
import css from './Section.module.scss'

const styles = styler(css)

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Remove the top spacing, eg. for the first section on a page */
  flush?: boolean
}

export function Section({flush, ...props}: SectionProps) {
  return (
    <section {...props} className={styles.root(styler.merge(props), {flush})} />
  )
}
