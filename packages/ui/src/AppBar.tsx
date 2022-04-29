import {ComponentType, HTMLAttributes} from 'react'
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
      icon?: ComponentType
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
      <Tag {...props} className={styles.item.mergeProps(props)({interactive})}>
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
