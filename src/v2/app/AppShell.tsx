import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import type {Dashboard} from '../dashboard/Dashboard.js'
import css from './AppShell.module.css'
import {LocaleMenu} from './LocaleMenu.js'
import {SidebarTree} from './SidebarTree.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'

const styles = styler(css)

interface AppShellProps {
  dashboard: Dashboard
}

export function AppShell({dashboard}: AppShellProps) {
  const sha = useAtomValue(dashboard.sha)
  return (
    <div className={styles.root()}>
      <aside className={styles.left()}>
        <div className={styles.leftSectionHeader()}>
          <WorkspaceMenu dashboard={dashboard} />
        </div>

        <div className={styles.treeWrap()}>
          <SidebarTree dashboard={dashboard} />
        </div>

        <footer className={styles.leftFooter()}>
          <div className={styles.meta()}>db.sha: {sha}</div>
        </footer>
      </aside>

      <main className={styles.main()}>
        <header className={styles.mainHeader()}>
          <h1 className={styles.mainTitle()}>Title</h1>
          <LocaleMenu dashboard={dashboard} />
        </header>

        {/*<div className={styles.mainBody()}>
          <div className={styles.explorerPane()}>
            <ContentExplorer
              graph={db}
              config={config}
              workspace={route.workspace || workspace}
              root={route.root}
              entry={route.entry}
              locale={selectedLocale}
              onScopeTitleChange={setMainTitle}
              onOpenEntry={function onOpenEntry(entryId) {
                const workspaceId = route.workspace || workspace
                const rootId = route.root
                if (!workspaceId || !rootId) return
                const nextRoute = {
                  workspace: workspaceId,
                  root: rootId,
                  entry: entryId,
                  locale: route.locale
                }
                setRoute(nextRoute)
                void applyTreeRouteState(nextRoute)
              }}
            />
          </div>
          <div className={styles.editorPane()}>
            <EntryEditor
              graph={db}
              config={config}
              views={views}
              workspace={route.workspace || workspace}
              root={route.root}
              entry={route.entry}
              locale={selectedLocale}
            />
          </div>
        </div>*/}
      </main>
    </div>
  )
}
