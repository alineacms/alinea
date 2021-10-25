import {HTMLAttributes} from 'react'
import type {IconType} from 'react-icons'
import css from './AppBar.module.scss'
import {Icon} from './Icon'
import {HStack} from './Stack'
import {PropsWithAs} from './util/PropsWithAs'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace AppBar {
  export const Root = styles.root.toElement('header')

  export type ItemProps = PropsWithAs<
    {
      icon?: IconType
      full?: boolean
    } & HTMLAttributes<HTMLDivElement>
  >

  export function Item({
    children,
    as: Tag = 'div',
    full,
    icon,
    ...props
  }: ItemProps) {
    const interactive = Tag === 'button' || Tag === 'a'
    return (
      <Tag
        {...props}
        className={styles.item.is({interactive}).mergeProps(props)()}
      >
        <HStack center gap={8} full>
          <Icon icon={icon} />
          {children}
        </HStack>
      </Tag>
    )
  }
}
