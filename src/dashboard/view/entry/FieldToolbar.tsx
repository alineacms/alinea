import {fromModule} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {createSlots} from 'alinea/ui/util/Slots'
import css from './FieldToolbar.module.scss'

const styles = fromModule(css)

export namespace FieldToolbar {
  export const {Provider, Portal, Slot, useSlots} = createSlots()

  export function Root() {
    const {shown} = useSlots()
    return (
      <AppBar.Root className={styles.root({active: shown})}>
        <Portal className={styles.root.inner()} />
      </AppBar.Root>
    )
  }
}
