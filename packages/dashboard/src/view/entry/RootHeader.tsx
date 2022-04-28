import {Create, fromModule, TextLabel} from '@alinea/ui'
import {Link, useNavigate} from 'react-router-dom'
import {useCurrentDraft} from '../../hook/UseCurrentDraft'
import {useNav} from '../../hook/UseNav'
import {useRoot} from '../../hook/UseRoot'
import {useWorkspace} from '../../hook/UseWorkspace'
import css from './RootHeader.module.scss'

const styles = fromModule(css)

export function RootHeader() {
  const navigate = useNavigate()
  const nav = useNav()
  const root = useRoot()
  const {name: workspace} = useWorkspace()
  const draft = useCurrentDraft()
  return (
    <div className={styles.root({active: !draft})}>
      <div className={styles.root.inner()}>
        <Link
          to={nav.root({workspace, root: root.name})}
          className={styles.root.link()}
        >
          <TextLabel label={root.label} />
        </Link>
        {root.i18n && (
          <div>
            <select
              onChange={e => {
                const locale = e.target.value
                const translation = draft.translation(locale)
                navigate(
                  nav.entry({
                    id: translation?.id || draft.id,
                    workspace,
                    root: root.name,
                    locale
                  })
                )
              }}
            >
              {root.i18n.locales.map(locale => (
                <option key={locale} value={locale}>
                  {locale.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        <Create.Link to={nav.create({workspace, root: root.name})} />
      </div>
    </div>
  )
}
