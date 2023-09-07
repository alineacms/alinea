import {fromModule} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {EntryEditProps} from '../EntryEdit.js'
import css from './EntryHistory.module.scss'

const styles = fromModule(css)

export function EntryHistory({editor}: EntryEditProps) {
  return <AppBar.Root className={styles.root()}>History</AppBar.Root>
}
