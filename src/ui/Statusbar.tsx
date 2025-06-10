import styler from '@alinea/styler'
import type {ComponentType} from 'react'
import type {PropsWithChildren} from 'react'
import {Icon} from './Icon.js'
import {HStack} from './Stack.js'
import css from './Statusbar.module.scss'
import {createSlots} from './util/Slots.js'

const styles = styler(css)

export namespace Statusbar {
  export const {Provider, Portal, Slot} = createSlots()

  export function Root({children}: PropsWithChildren<{}>) {
    return (
      <footer className={styles.root()}>
        {children}
        <div className={styles.root.slots()}>
          <Portal />
        </div>
      </footer>
    )
  }

  export type StatusProps = PropsWithChildren<{
    icon?: ComponentType
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
