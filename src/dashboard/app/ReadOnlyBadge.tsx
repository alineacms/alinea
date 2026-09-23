import {styler} from '@alinea/styler'
import type {ComponentPropsWithoutRef} from 'react'
import {IcOutlineLock} from '../icons.js'
import {Badge} from '#/components.js'
import css from './ReadOnlyBadge.module.css'

const styles = styler(css)

export interface ReadOnlyBadgeProps extends ComponentPropsWithoutRef<'span'> {}

export function ReadOnlyBadge(props: ReadOnlyBadgeProps) {
  return (
    <Badge
      {...props}
      aria-label="Read-only access"
      className={styles.ReadOnlyBadge(styler.merge(props))}
      icon={IcOutlineLock}
      title="You have read-only access"
    >
      Read only
    </Badge>
  )
}
