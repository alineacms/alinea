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

function H2(props: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 {...props}>
      {props.children}
      {props.id && <a href={`#${props.id}`}>#</a>}
    </h2>
  )
}

export const WebTypo = createTypo(styles, {a: Link, h2: H2})
