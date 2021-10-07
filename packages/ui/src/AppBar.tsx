import {HTMLAttributes} from 'react'
import type {IconType} from 'react-icons'
import {HStack} from '.'
import css from './AppBar.module.scss'
import {Icon} from './Icon'
import {PropsWithAs} from './util/PropsWithAs'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace AppBar {
  export const Root = styles.root.toElement('header')

  export type ItemProps = PropsWithAs<
    {
      icon?: IconType
    } & HTMLAttributes<HTMLDivElement>
  >

  export function Item({children, as: Tag = 'div', icon, ...props}: ItemProps) {
    const interactive = Tag === 'button' || Tag === 'a'
    return (
      <Tag
        {...props}
        className={styles.item.is({interactive}).mergeProps(props)()}
      >
        <HStack center gap={8}>
          <Icon icon={icon} />
          <div>{children}</div>
        </HStack>
      </Tag>
    )
  }
}
