import {fromModule, HStack, Icon} from 'alinea/ui'
import Link, {LinkProps} from 'next/link'
import {ComponentType, PropsWithChildren} from 'react'
import css from './Button.module.scss'

const styles = fromModule(css)

export type ButtonProps = PropsWithChildren<LinkProps> & {
  className?: string
  icon?: ComponentType
  iconRight?: ComponentType
}

export function Button({children, icon, iconRight, ...props}: ButtonProps) {
  return (
    <Link {...props}>
      <a className={styles.root.mergeProps(props)()}>
        <HStack center gap={8}>
          <Icon icon={icon} />
          <span>{children}</span>
          <Icon icon={iconRight} />
        </HStack>
      </a>
    </Link>
  )
}
