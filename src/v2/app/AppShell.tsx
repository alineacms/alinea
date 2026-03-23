import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {Suspense} from 'react'
import {DashboardScopeInternal} from '../store.js'
import type {Dashboard} from '../store/Dashboard.js'
import css from './AppShell.module.css'
import {Editor} from './Editor.js'
import {SidebarTree} from './SidebarTree.js'
import {Sidebar, SidebarBody, SidebarFooter, SidebarHeader} from './ui/Sidebar.js'
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
        <Sidebar
          className={styles.left()}
          divider="right"
          layout
        >
          <SidebarHeader className={styles.leftSectionHeader()}>
            <WorkspaceMenu dashboard={dashboard} />
          </SidebarHeader>

          <SidebarBody className={styles.treeWrap()} scroll>
            <SidebarTree dashboard={dashboard} />
          </SidebarBody>

          <SidebarFooter className={styles.leftFooter()}>
            <div className={styles.meta()}>db.sha: {sha}</div>
          </SidebarFooter>
        </Sidebar>

        <main className={styles.main()}>
          <Suspense fallback={<div>Loading...</div>}>
            <Editor dashboard={dashboard} />
          </Suspense>
        </main>
      </div>
    </DashboardScopeInternal>
  )
}
