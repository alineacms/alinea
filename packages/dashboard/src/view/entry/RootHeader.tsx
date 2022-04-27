import { Create, fromModule, TextLabel } from '@alinea/ui'
import { Link } from 'react-router-dom'
import { useCurrentDraft } from '../../hook/UseCurrentDraft'
import { useDashboard } from '../../hook/UseDashboard'
import { useRoot } from '../../hook/UseRoot'
import { useWorkspace } from '../../hook/UseWorkspace'
import css from './RootHeader.module.scss'

const styles = fromModule(css)

export function RootHeader() {
  const {nav} = useDashboard()
  const root = useRoot()
  const {name: workspace} = useWorkspace()
  const draft = useCurrentDraft()
  return (
    <div className={styles.root({active: !draft})}>
    <div className={styles.root.inner()}>
      <Link to={nav.root(workspace, root.name)} className={styles.root.link()}>
        <TextLabel label={root.label} />
      </Link>
      <Create.Link to={nav.create(workspace, root.name)} />
      </div>
    </div>
  )
}
