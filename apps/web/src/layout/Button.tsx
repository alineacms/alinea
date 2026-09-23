import styler from '@alinea/styler'
import {Icon} from 'alinea/components/Icon'
import Link, {type LinkProps} from 'next/link'
import type {ComponentType, PropsWithChildren} from 'react'
import css from './Button.module.scss'

const styles = styler(css)

export type ButtonVariant = 'primary' | 'secondary'

export interface ButtonProps extends PropsWithChildren<LinkProps> {
  className?: string
  icon?: ComponentType
  iconRight?: ComponentType
  target?: string
  variant?: ButtonVariant
}

// Link objects from the CMS are spread onto the button, drop their metadata
const linkMetadata = [
  '_entry',
  '_id',
  '_index',
  '_target',
  '_title',
  '_type',
  '_url',
  'entryId',
  'entryType',
  'fields',
  'path',
  'url'
]

export function Button({
  children,
  icon,
  iconRight,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const linkProps = {...props}
  for (const key of linkMetadata) Reflect.deleteProperty(linkProps, key)
  return (
    <Link
      {...linkProps}
      className={styles.root(styler.merge(props), {
        secondary: variant === 'secondary'
      })}
    >
      {icon && <Icon icon={icon} />}
      <span className={styles.root.label()}>{children}</span>
      {iconRight && <Icon icon={iconRight} />}
    </Link>
  )
}
