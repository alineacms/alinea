import type {ComponentType} from 'react'
import {ButtonHTMLAttributes} from 'react'
import css from './Button.module.scss'
import {Icon} from './Icon'
import {HStack} from './Stack'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export type ButtonProps = {
  icon?: ComponentType
  iconRight?: ComponentType
  size?: 'small' | 'medium' | 'large'
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  children,
  size = 'medium',
  icon,
  iconRight,
  ...props
}: ButtonProps) {
  return (
    <button {...props} className={styles.root.mergeProps(props)(size)}>
      <HStack center gap={8}>
        <Icon icon={icon} />
        <div>{children}</div>
        <Icon icon={iconRight} />
      </HStack>
    </button>
  )
}
