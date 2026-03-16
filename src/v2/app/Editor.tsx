import {styler} from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {
  Dashboard,
  DashboardEntry,
  DashboardRoot
} from '../dashboard/Dashboard.js'
import css from './Editor.module.css'

const styles = styler(css)

export interface EditorProps {
  dashboard: Dashboard
}

export function Editor({dashboard}: EditorProps) {
  const focused = useAtomValue(dashboard.focused)
  if (!focused) return null
  if ('entry' in focused) return <EntryEditor entry={focused.entry} />
  return <RootEditor root={focused.root} />
}

interface RootEditorProps {
  root: DashboardRoot
}

function RootEditor({root}: RootEditorProps) {
  const title = useAtomValue(root.label)
  return (
    <div>
      <h2>{title}</h2>
    </div>
  )
}
interface EntryEditorProps {
  entry: DashboardEntry
}

function EntryEditor({entry}: EntryEditorProps) {
  const title = useAtomValue(entry.label)
  // const type = useAtomValue(entry.type)
  return (
    <>
      <header className={styles.mainHeader()}>
        <h1 className={styles.mainTitle()}>{title}</h1>
      </header>

      <div className={styles.mainBody()}>
        <p>Content</p>
      </div>
    </>
  )
}
