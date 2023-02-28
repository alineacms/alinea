import {ComponentType, HTMLAttributes} from 'react'
import css from './AppBar.module.scss'
import {Icon} from './Icon.js'
import {HStack} from './Stack.js'
import {PropsWithAs} from './util/PropsWithAs.js'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export namespace AppBar {
  export const Root = styles.root.toElement('header')

  export type ItemProps = PropsWithAs<
    {
      icon?: ComponentType
      full?: boolean
      active?: boolean
    } & HTMLAttributes<HTMLDivElement>
  >

  export function Item({
    children,
    as: Tag = 'div',
    full,
    icon,
    active,
    ...props
  }: ItemProps) {
    const interactive = Tag === 'button' || Tag === 'a'
    return (
      <Tag
        {...props}
        className={styles.item.mergeProps(props)({interactive, active})}
      >
        <HStack center gap={8} full>
          {icon && (
            <div className={styles.item.icon()}>
              <Icon icon={icon} />
            </div>
          )}
          {children}
        </HStack>
      </Tag>
    )
  }
}
