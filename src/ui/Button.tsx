import type {
  ComponentProps,
  ComponentType,
  ElementType,
  PropsWithChildren
} from 'react'
import css from './Button.module.scss'
import {Icon} from './Icon.js'
import {HStack} from './Stack.js'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export type ButtonProps<T extends ElementType> = PropsWithChildren<
  {
    as?: T
    icon?: ComponentType
    iconRight?: ComponentType
    size?: 'small' | 'medium' | 'large'
    outline?: boolean
  } & Omit<ComponentProps<T>, 'as'>
>

export function Button<T extends ElementType = 'button'>({
  as = 'button' as T,
  children,
  size = 'medium',
  icon,
  iconRight,
  outline,
  ...props
}: ButtonProps<T>) {
  const Tag: any = as
  return (
    <Tag {...props} className={styles.root.mergeProps(props)(size, {outline})}>
      <HStack center gap={8}>
        <Icon icon={icon} />
        <span>{children}</span>
        <Icon icon={iconRight} />
      </HStack>
    </Tag>
  )
}
