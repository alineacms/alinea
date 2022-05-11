import type {LinkHTMLAttributes} from 'react'
import {Link as LinkReactRouter} from 'react-router-dom'
import css from './Link.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export type LinkProps = {
  href: string
  external?: boolean
} & LinkHTMLAttributes<HTMLAnchorElement>

export function Link({href, external, children, ...props}: LinkProps) {
  const isInternal = href && !external
  const Comp: any = isInternal ? LinkReactRouter : 'a'
  const compProps = isInternal ? {to: href} : {}

  return (
    <Comp {...props} {...compProps} className={styles.root.mergeProps(props)()}>
      {children}
    </Comp>
  )
}
