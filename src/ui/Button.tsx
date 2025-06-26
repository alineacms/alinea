import styler from '@alinea/styler'
import type {
  ComponentProps,
  ComponentType,
  ElementType,
  PropsWithChildren
} from 'react'
import css from './Button.module.scss'
import {Icon} from './Icon.js'
import {HStack} from './Stack.js'

const styles = styler(css)

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
  variant,
  ...props
}: ButtonProps<T>) {
  const Tag: any = as
  return (
    <Tag
      {...props}
      className={styles.root(size, variant, {outline}, styler.merge(props))}
    >
      <HStack center gap={8}>
        <Icon icon={icon} size={18} />
        <span>{children}</span>
        <Icon icon={iconRight} />
      </HStack>
    </Tag>
  )
}
