import type {ComponentType} from 'react'
import css from './Chip.module.scss'
import {Icon} from './Icon'
import {HStack, StackProps} from './Stack'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export type ChipProps = StackProps & {
  icon?: ComponentType
  accent?: boolean
}

export function Chip({children, icon, accent, ...props}: ChipProps) {
  return (
    <HStack
      center
      {...props}
      className={styles.root.mergeProps(props)({accent})}
    >
      {icon && <Icon className={styles.root.icon()} icon={icon} />}
      <div className={styles.root.label()}>{children}</div>
    </HStack>
  )
}
