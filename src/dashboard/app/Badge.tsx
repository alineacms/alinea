import {styler} from '@alinea/styler'
import {
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ReactElement
} from 'react'
import {Icon} from '../../components/Icon.js'
import css from './Badge.module.css'

const styles = styler(css)

interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  icon?: ComponentType | ReactElement
  size?: 'default' | 'small'
  status?: 'published' | 'draft' | 'unpublished' | 'archived' | 'untranslated'
}

export function Badge({
  children,
  icon,
  size = 'default',
  status,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      data-status={status}
      data-size={size}
      className={styles.Badge(styler.merge(props))}
    >
      {icon && <Icon icon={icon} data-slot="icon" />}
      <span>{children}</span>
    </span>
  )
}
