import {Menu} from '@headlessui/react'
import {ButtonHTMLAttributes, HTMLAttributes} from 'react'
import css from './DropdownMenu.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace DropdownMenu {
  export function Root(props: HTMLAttributes<HTMLDivElement>) {
    return (
      <Menu>
        <div {...props} className={styles.root.mergeProps(props)()} />
      </Menu>
    )
  }
  export const Trigger: typeof Menu.Button = styles.trigger.toElement(
    Menu.Button
  ) as any

  export function Items({
    left,
    right,
    ...props
  }: HTMLAttributes<HTMLDivElement> & {left?: boolean; right?: boolean}) {
    return (
      <Menu.Items
        {...props}
        className={styles.items.mergeProps(props)({left, right})}
      />
    )
  }
  export function Item(props: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
      <Menu.Item>
        {({active}: {active: boolean}) => {
          return (
            <button
              {...props}
              className={styles.item.mergeProps(props)({active})}
            />
          )
        }}
      </Menu.Item>
    )
  }
}
