import {link} from 'alinea/dashboard/util/HashRouter'
import {TextLabel, fromModule} from 'alinea/ui'
import {useNav} from '../../hook/UseNav.js'
import {useRoot} from '../../hook/UseRoot.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import css from './RootHeader.module.scss'

const styles = fromModule(css)

export interface RootHeaderProps {
  active?: boolean
}

export function RootHeader({active}: RootHeaderProps) {
  const nav = useNav()
  const root = useRoot()
  const {name: workspace} = useWorkspace()
  return (
    <div className={styles.root({active})}>
      <div className={styles.root.inner()}>
        <a
          {...link(nav.root({workspace, root: root.name}))}
          className={styles.root.link()}
        >
          <TextLabel label={root.label} />
        </a>
        {/*<Create.Link href={nav.create({workspace, root: root.name})} />*/}
      </div>
    </div>
  )
}
