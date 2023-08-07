import {useFloating} from '@floating-ui/react-dom'
import {Menu} from '@headlessui/react'
import {ButtonHTMLAttributes, HTMLAttributes, createContext} from 'react'
import css from './DropdownMenu.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export namespace DropdownMenu {
  const floatingContext = createContext<ReturnType<typeof useFloating>>(
    undefined!
  )

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
    placement: 'top' | 'bottom'
  }

  export function Items({placement, ...props}: ItemsProps) {
    return (
      <Menu.Items
        {...props}
        className={styles.items.mergeProps(props)(placement)}
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
