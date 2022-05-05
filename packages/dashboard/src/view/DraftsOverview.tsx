import {fromModule} from '@alinea/ui'
import css from './DraftsOverview.module.scss'

const styles = fromModule(css)

export function DraftsOverview() {
  return <div className={styles.root()}>drafts</div>
}
