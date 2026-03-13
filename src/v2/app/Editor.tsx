import {styler} from '@alinea/styler'
import {Dashboard} from '../dashboard/Dashboard.js'
import css from './Editor.module.css'

const styles = styler(css)

export interface EditorProps {
  dashboard: Dashboard
}

export function Editor({dashboard}: EditorProps) {
  return (
    <>
      <header className={styles.mainHeader()}>
        <h1 className={styles.mainTitle()}>Title</h1>
      </header>

      <div className={styles.mainBody()}>
        <p>Content</p>
      </div>
    </>
  )
}
