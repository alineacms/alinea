import {createTypo} from 'alinea/ui/util/CreateTypo'
import {fromModule} from 'alinea/ui/util/Styler'
import NextLink from 'next/link'
import {HTMLAttributes} from 'react'
import css from './WebTypo.module.scss'

const styles = fromModule(css)

interface LinkProps {
  href?: string
  [key: string]: any
}

function Link({href, ...props}: LinkProps) {
  return href ? <NextLink href={href!} {...props} /> : <a {...props} />
}

function withPermaLink(Tag: string) {
  return (props: HTMLAttributes<HTMLHeadingElement>) => (
    <Tag {...props}>
      {props.id && <a href={`#${props.id}`} className={styles.permaLink()} />}
      {props.children}
    </Tag>
  )
}

export const WebTypo = createTypo(styles, {
  a: Link,
  h2: withPermaLink('h2'),
  h3: withPermaLink('h3')
})
