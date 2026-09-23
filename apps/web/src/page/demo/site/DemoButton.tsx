import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './DemoButton.module.scss'

const styles = styler(css)

export interface DemoButtonProps {
  href?: string
  variant?: 'solid' | 'light' | 'text'
  type?: 'button' | 'submit'
  children: ReactNode
}

export function DemoButton({
  href,
  variant = 'solid',
  type = 'button',
  children
}: DemoButtonProps) {
  const className = styles.DemoButton({[variant]: true})
  if (href)
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  return (
    <button type={type} className={className}>
      {children}
    </button>
  )
}
