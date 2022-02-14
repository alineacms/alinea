import {PropsWithChildren} from 'react'
import type {IconType} from 'react-icons'
import {Icon} from './Icon'
import {HStack} from './Stack'
import css from './Statusbar.module.scss'
import {createSlots} from './util/Slots'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Statusbar {
  export const {Provider, Portal, Slot} = createSlots()

  export function Root({children}: PropsWithChildren<{}>) {
    return (
      <footer className={styles.root()}>
        <Portal />
        {children}
      </footer>
    )
  }

  export type StatusProps = PropsWithChildren<{
    icon: IconType
  }>

  export function Status({children, icon}: StatusProps) {
    return (
      <div className={styles.status()}>
        <HStack center gap={5}>
          <Icon icon={icon} />
          <span>{children}</span>
        </HStack>
      </div>
    )
  }
}
