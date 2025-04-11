import styler from '@alinea/styler'
import type {ComponentType} from 'react'
import css from './Chip.module.scss'
import {Icon} from './Icon.js'
import {HStack, type StackProps} from './Stack.js'

const styles = styler(css)

export type ChipProps = StackProps & {
  icon?: ComponentType
  accent?: boolean
  variant?: 'info' | 'success' | 'disabled' | 'progress'
}

export function Chip({children, icon, accent, variant, ...props}: ChipProps) {
  return (
    <HStack
      center
      {...props}
      className={styles.root.mergeProps(props)({accent}, variant)}
    >
      {icon && <Icon className={styles.root.icon()} icon={icon} />}
      <div className={styles.root.label()}>{children}</div>
    </HStack>
  )
}
