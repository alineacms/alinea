import styler from '@alinea/styler'
import type {
  HTMLAttributeReferrerPolicy,
  MouseEvent,
  ReactNode,
  Ref
} from 'react'
import css from './Link.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface LinkProps extends StyleProps, AriaProps, DataProps {
  href?: string
  target?: string
  rel?: string
  download?: boolean | string
  /** Tooltip text */
  title?: string
  tabIndex?: number
  lang?: string
  hrefLang?: string
  referrerPolicy?: HTMLAttributeReferrerPolicy
  'aria-current'?: boolean | 'page' | 'step' | 'location' | 'date' | 'time'
  /** `plain` underlines on hover, `underline` is always underlined */
  variant?: 'plain' | 'underline'
  disabled?: boolean
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  ref?: Ref<HTMLAnchorElement>
  children?: ReactNode
}

export function Link({
  variant = 'plain',
  href,
  target,
  rel,
  disabled,
  className,
  onClick,
  ...props
}: LinkProps) {
  return (
    <a
      data-slot="link"
      {...props}
      data-variant={variant}
      href={disabled ? undefined : href}
      target={target}
      rel={rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)}
      aria-disabled={disabled || undefined}
      onClick={event => {
        if (disabled) event.preventDefault()
        else onClick?.(event)
      }}
      className={styles.Link(styler.merge({className}))}
    />
  )
}
