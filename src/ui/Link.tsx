import type {LinkHTMLAttributes} from 'react'
import css from './Link.module.scss'
import {link} from './util/HashRouter'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

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
