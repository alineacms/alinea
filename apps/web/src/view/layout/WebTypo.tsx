import {createTypo} from 'alinea/ui/util/CreateTypo'
import {fromModule} from 'alinea/ui/util/Styler'
import NextLink from 'next/link'
import css from './WebTypo.module.scss'

const styles = fromModule(css)

interface LinkProps {
  href?: string
  [key: string]: any
}

function Link({href, ...props}: LinkProps) {
  return href ? (
    <NextLink href={href!}>
      <a {...props} />
    </NextLink>
  ) : (
    <a {...props} />
  )
}

export const WebTypo = createTypo(styles, Link)
