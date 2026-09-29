import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './Kbd.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface KbdProps extends StyleProps, AriaProps, DataProps {
  size?: 'sm' | 'default'
  children: ReactNode
}

/** A keyboard key or shortcut, eg. <Kbd>⌘ K</Kbd> */
export function Kbd({size = 'default', className, ...props}: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      {...props}
      data-size={size}
      className={styles.Kbd(styler.merge({className}))}
    />
  )
}
