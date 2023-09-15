import {ComponentType, HTMLAttributes} from 'react'
import css from './AppBar.module.scss'
import {Icon} from './Icon.js'
import {HStack} from './Stack.js'
import {PropsWithAs} from './util/PropsWithAs.js'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export namespace AppBar {
  export interface RootProps extends HTMLAttributes<HTMLElement> {
    variant?:
      | 'draft'
      | 'editing'
      | 'published'
      | 'archived'
      | 'archiving'
      | 'publishing'
      | 'untranslated'
      | 'revision'
  }

  export function Root({variant, ...props}: RootProps) {
    return (
      <header {...props} className={styles.root.mergeProps(props)(variant)} />
    )
  }

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
