import type {IconType} from 'react-icons'
import css from './Chip.module.scss'
import {Icon} from './Icon'
import {HStack, StackProps} from './Stack'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export type ChipProps = StackProps & {
  icon?: IconType
  accent?: boolean
}

export function Chip({children, icon, accent, ...props}: ChipProps) {
  return (
    <HStack
      center
      {...props}
      className={styles.root.is({accent}).mergeProps(props)()}
    >
      {icon && <Icon className={styles.root.icon()} icon={icon} />}
      <div className={styles.root.label()}>{children}</div>
    </HStack>
  )
}
