import {fromModule, TextLabel} from '@alinea/ui'
import {Link} from 'react-router-dom'
import {useDashboard} from '../../hook/UseDashboard'
import {useRoot} from '../../hook/UseRoot'
import {useSession} from '../../hook/UseSession'
import {useWorkspace} from '../../hook/UseWorkspace'
import css from './RootHeader.module.scss'

const styles = fromModule(css)

export function RootHeader() {
  const {hub} = useSession()
  const {nav} = useDashboard()
  const root = useRoot()
  const {name: workspace, schema} = useWorkspace()
  return (
    <Link to={nav.entry(workspace, root.name)} className={styles.root()}>
      <div className={styles.root.title()}>
        <TextLabel label={root.label} />
      </div>
      {/*types.length > 0 ? (
        <div className={styles.root.create()}>
          <div className={styles.root.create.inner()}>
            <Create.Root>
              {types.map((typeKey, i) => {
                const type = schema.type(typeKey)
                if (!type) return null
                return (
                  <Create.Link
                    key={i}
                    icon={type.options.icon}
                    to={nav.create(workspace, root.name, target?.id)}
                  >
                    <TextLabel label={type.label} />
                  </Create.Link>
                )
              })}
            </Create.Root>
          </div>
        </div>
      ) : (
        <div></div>
      )*/}
    </Link>
  )
}
