import {InputState} from '@alinea/editor/InputState'
import {fromModule} from '@alinea/ui'
import {TabsField} from './TabsField'
import css from './TabsView.module.scss'

const styles = fromModule(css)

export type TabsViewProps<T> = {
  state: InputState<T>
  field: TabsField
}

export function TabsView<T>({field}: TabsViewProps<T>) {
  return <div className={styles.root()}>tabs</div>
}
