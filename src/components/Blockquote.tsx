import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './Blockquote.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface BlockquoteProps extends StyleProps, AriaProps, DataProps {
  cite?: string
  children: ReactNode
}

export function Blockquote({className, ...props}: BlockquoteProps) {
  return (
    <blockquote
      data-slot="blockquote"
      {...props}
      className={styles.Blockquote(styler.merge({className}))}
    />
  )
}
