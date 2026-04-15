import styler from '@alinea/styler'
import type {LinkHTMLAttributes} from 'react'
import {link} from '../dashboard/util/HashRouter.js'
import css from './Link.module.scss'

const styles = styler(css)

export type LinkProps = {
  href: string
  external?: boolean
} & LinkHTMLAttributes<HTMLAnchorElement>

export function Link({href, external, children, ...props}: LinkProps) {
  const isInternal = href && !external
  const compProps = isInternal ? link(href) : {href}
  return (
    <a {...props} {...compProps} className={styles.root.mergeProps(props)()}>
      {children}
    </a>
  )
}
