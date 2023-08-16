import {Menu} from '@headlessui/react'
import {ButtonHTMLAttributes, HTMLAttributes} from 'react'
import css from './DropdownMenu.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export namespace DropdownMenu {
  export function Root(props: HTMLAttributes<HTMLDivElement>) {
    return (
      <Menu>
        <div {...props} className={styles.root.mergeProps(props)()} />
      </Menu>
    )
  }

  export function Trigger(props: HTMLAttributes<HTMLButtonElement>) {
    return (
      <Menu.Button {...props} className={styles.trigger.mergeProps(props)()} />
    )
  }

  export interface ItemsProps extends HTMLAttributes<HTMLDivElement> {
    top?: boolean
    right?: boolean
    bottom?: boolean
    left?: boolean
  }

  export function Items({top, bottom, left, right, ...props}: ItemsProps) {
    return (
      <Menu.Items
        {...props}
        className={styles.items.mergeProps(props)({top, bottom, left, right})}
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
