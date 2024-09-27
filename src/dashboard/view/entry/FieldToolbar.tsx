import styler from '@alinea/styler'
import {AppBar} from 'alinea/ui/AppBar'
import {createSlots} from 'alinea/ui/util/Slots'
import {HTMLProps} from 'react'
import css from './FieldToolbar.module.scss'

const styles = styler(css)

export namespace FieldToolbar {
  export const {Provider, Portal, Slot, useSlots} = createSlots()

  // Workaround a bug in Vite/SWC, whatever is used by Ladle
  const InnerPortal = Portal

  export function Root(props: HTMLProps<HTMLDivElement>) {
    const {shown} = useSlots()
    return (
      <AppBar.Root
        {...props}
        className={styles.root.mergeProps(props)({active: shown})}
      >
        <InnerPortal className={styles.root.inner()} />
      </AppBar.Root>
    )
  }
}
