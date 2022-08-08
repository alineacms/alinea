import {createTypo} from '@alinea/ui/util/CreateTypo'
import {fromModule} from '@alinea/ui/util/Styler'
import NextLink from 'next/link'
import css from './WebTypo.module.scss'

const styles = fromModule(css)

interface LinkProps {
  href?: string
  [key: string]: any
}

function Link({href, ...props}: LinkProps) {
  return (
    <NextLink href={href!}>
      <a {...props} />
    </NextLink>
  )
}

export const WebTypo = createTypo(styles, Link)
