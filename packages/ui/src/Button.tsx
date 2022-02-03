import {ButtonHTMLAttributes} from 'react'
import type {IconType} from 'react-icons'
import css from './Button.module.scss'
import {Icon} from './Icon'
import {HStack} from './Stack'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export type ButtonProps = {
  icon?: IconType
  size?: 'small' | 'medium' | 'large'
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  children,
  size = 'medium',
  icon,
  ...props
}: ButtonProps) {
  return (
    <button {...props} className={styles.root.mergeProps(props)(size)}>
      <HStack center gap={8}>
        <Icon icon={icon} />
        <div>{children}</div>
      </HStack>
    </button>
  )
}
