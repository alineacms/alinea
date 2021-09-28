import type {IconType} from 'react-icons'
import css from './Chip.module.scss'
import {HStack, StackProps} from './Stack'
import {fromModule} from './util/styler'

const styles = fromModule(css)

export type ChipProps = StackProps & {
  icon?: IconType
}

export function Chip({children, icon: Icon, ...props}: ChipProps) {
  return (
    <HStack
      center
      {...(props as any)}
      className={styles.root.mergeProps(props)()}
    >
      {Icon && <Icon />}
      <div className={styles.root.label()}>{children}</div>
    </HStack>
  )
}
