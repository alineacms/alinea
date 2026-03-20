import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {Suspense} from 'react'
import {DashboardScopeInternal} from '../store.js'
import type {Dashboard} from '../store/Dashboard.js'
import css from './AppShell.module.css'
import {Editor} from './Editor.js'
import {SidebarTree} from './SidebarTree.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'

const styles = styler(css)

interface AppShellProps {
  dashboard: Dashboard
}

export function AppShell({dashboard}: AppShellProps) {
  const sha = useAtomValue(dashboard.sha)
  return (
    <DashboardScopeInternal dashboard={dashboard}>
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
          <Suspense fallback={<div>Loading...</div>}>
            <Editor dashboard={dashboard} />
          </Suspense>
        </main>
      </div>
    </DashboardScopeInternal>
  )
}
