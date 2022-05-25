import {Disclosure} from '@headlessui/react'
import {HTMLAttributes} from 'react'
import css from './Accordion.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Accordion {
  export function Root({
    left,
    center,
    right,
    ...props
  }: HTMLAttributes<HTMLDivElement> & {
    left?: boolean
    center?: boolean
    right?: boolean
  }) {
    return (
      <Disclosure>
        {({open}) => (
          <div
            {...props}
            className={styles.root.mergeProps(props)({
              left,
              center,
              right,
              open
            })}
          />
        )}
      </Disclosure>
    )
  }
  export function Trigger({
    round,
    children
  }: HTMLAttributes<HTMLButtonElement> & {
    round?: boolean
  }) {
    return (
      <Disclosure.Button
        className={styles.trigger({
          round
        })}
      >
        {children}
      </Disclosure.Button>
    )
  }
  export const Item: typeof Disclosure.Panel = styles.item.toElement(
    Disclosure.Panel
  ) as any
}
