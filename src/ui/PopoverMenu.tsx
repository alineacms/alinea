import {Popover} from '@headlessui/react'
import {HTMLAttributes, PropsWithChildren} from 'react'
import css from './PopoverMenu.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export namespace PopoverMenu {
  export function Root(props: HTMLAttributes<HTMLDivElement>) {
    return (
      <Popover>
        <div {...props} className={styles.root.mergeProps(props)()} />
      </Popover>
    )
  }
  export const Trigger: typeof Popover.Button = styles.trigger.toElement(
    Popover.Button
  ) as any

  export function Items({
    left,
    right,
    ...props
  }: HTMLAttributes<HTMLDivElement> & {left?: boolean; right?: boolean}) {
    return (
      <Popover.Panel
        {...props}
        className={styles.items.mergeProps(props)({left, right})}
      />
    )
  }

  export function Header({children}: PropsWithChildren<{}>) {
    return (
      <div className={styles.header()}>
        <header>{children}</header>
      </div>
    )
  }

  export function Footer({children}: PropsWithChildren<{}>) {
    return (
      <div className={styles.footer()}>
        <footer>{children}</footer>
      </div>
    )
  }
}
