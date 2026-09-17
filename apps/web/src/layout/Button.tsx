import styler from '@alinea/styler'
import {HStack, Icon} from 'alinea/ui'
import Link, {type LinkProps} from 'next/link'
import type {ComponentType, PropsWithChildren} from 'react'
import css from './Button.module.scss'

const styles = styler(css)

export type ButtonProps = PropsWithChildren<LinkProps> & {
  className?: string
  icon?: ComponentType
  iconRight?: ComponentType
  target?: string
}

export function Button({children, icon, iconRight, ...props}: ButtonProps) {
  {
    ;[
      '_entry',
      '_id',
      '_index',
      '_target',
      '_title',
      '_type',
      '_url',
      'entryId',
      'entryType',
      'fields',
      'path',
      'url'
    ].forEach(key => delete (props as any)[key])
  }

  return (
    <Link {...props} className={styles.root.mergeProps(props)()}>
      <HStack center gap={8}>
        <Icon icon={icon} />
        <span>{children}</span>
        <Icon icon={iconRight} />
      </HStack>
    </Link>
  )
}
