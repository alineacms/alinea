import styler from '@alinea/styler'
import type {PropsWithChildren} from 'react'
import css from './CloudButton.module.scss'

const styles = styler(css)

export interface CloudButtonProps {
  href: string
  variant?: 'primary' | 'outline'
  size?: 'default' | 'small'
}

export function CloudButton({
  href,
  variant = 'primary',
  size = 'default',
  children
}: PropsWithChildren<CloudButtonProps>) {
  return (
    <a
      href={href}
      className={styles.root({
        outline: variant === 'outline',
        small: size === 'small'
      })}
    >
      {children}
    </a>
  )
}
