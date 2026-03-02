import styler from '@alinea/styler'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {useAtom, useAtomValue} from 'jotai'
import {useEffect, useMemo} from 'react'
import {cmsRouteAtom} from '../atoms/cms/route.js'
import {currentWorkspaceAtom} from '../atoms/cms/workspaces.js'
import {dbAtom} from '../atoms/db.js'
import {configAtom} from '../atoms/config.js'
import css from './AppShell.module.css'
import {LocaleMenu} from './LocaleMenu.js'
import {SidebarTree} from './SidebarTree'
import {WorkspaceMenu} from './WorkspaceMenu.js'

const styles = styler(css)

export function AppShell() {
  const db = useAtomValue(dbAtom)
  const config = useAtomValue(configAtom)
  const [route, setRoute] = useAtom(cmsRouteAtom)
  const [workspace, setWorkspace] = useAtom(currentWorkspaceAtom)
  const workspaces = useMemo(() => {
    return Object.keys(config.workspaces).map(key => {
      return {id: key, label: String(Workspace.label(config.workspaces[key]))}
    })
  }, [config])
  const rootLocales = useMemo(() => {
    if (!route.workspace || !route.root) return []
    const workspaceConfig = config.workspaces[route.workspace]
    if (!workspaceConfig) return []
    const rootConfig = workspaceConfig[route.root]
    if (!rootConfig) return []
    return Root.data(rootConfig).i18n?.locales ?? []
  }, [config, route.root, route.workspace])
  const selectedLocale = useMemo(() => {
    if (!rootLocales.length) return undefined
    if (route.locale && rootLocales.includes(route.locale)) return route.locale
    return rootLocales[0]
  }, [rootLocales, route.locale])

  useEffect(
    function ensureWorkspaceInPath() {
      if (route.workspace || !workspace) return
      setWorkspace(workspace)
    },
    [route.workspace, setWorkspace, workspace]
  )
  useEffect(
    function keepLocaleInSyncWithRoot() {
      if (!rootLocales.length) {
        if (!route.locale) return
        setRoute(prev => ({...prev, locale: undefined}))
        return
      }
      if (!selectedLocale || route.locale === selectedLocale) return
      setRoute(prev => ({...prev, locale: selectedLocale}))
    },
    [rootLocales, route.locale, selectedLocale, setRoute]
  )

  return (
    <div className={styles.root()}>
      <aside className={styles.left()}>
        <div className={styles.leftSectionHeader()}>
          <WorkspaceMenu
            items={workspaces}
            selectedWorkspace={workspace}
            onSelectWorkspace={setWorkspace}
          />
        </div>

        <div className={styles.treeWrap()}>
          <SidebarTree />
        </div>

        <footer className={styles.leftFooter()}>
          <div className={styles.meta()}>db.sha: {db.sha || '-'}</div>
        </footer>
      </aside>

      <main className={styles.main()}>
        <header className={styles.mainHeader()}>
          <h1 className={styles.mainTitle()}>Main area</h1>
          <LocaleMenu
            locales={rootLocales}
            selectedLocale={selectedLocale}
            onSelectLocale={function onSelectLocale(locale) {
              setRoute(prev => ({...prev, locale}))
            }}
          />
        </header>

        <div className={styles.mainBody()}>
          <div className={styles.form()}>
            <p className={styles.meta()}>Placeholder: selected entry summary</p>
            <p className={styles.meta()}>Placeholder: field editor surface</p>
          </div>
        </div>
      </main>
    </div>
  )
}
