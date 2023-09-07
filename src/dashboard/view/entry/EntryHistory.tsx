import {fromModule} from 'alinea/ui'
import {useAtomValue} from 'jotai'
import {EntryEditProps} from '../EntryEdit.js'
import css from './EntryHistory.module.scss'

const styles = fromModule(css)

export function EntryHistory({editor}: EntryEditProps) {
  const revisions = useAtomValue(editor.revisionsAtom)
  console.log(revisions)
  return <header className={styles.root()}>History</header>
}
