import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {Suspense} from 'react'
import {DashboardScopeInternal} from '../store.js'
import type {Dashboard} from '../store/Dashboard.js'
import css from './AppShell.module.css'
import {Editor} from './Editor.js'
import {SidebarTree} from './SidebarTree.js'
import {Sidebar, SidebarFooter, SidebarHeader} from './ui/Sidebar.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'

const styles = styler(css)

interface AppShellProps {
  dashboard: Dashboard
}

export function AppShell({dashboard}: AppShellProps) {
  const sha = useAtomValue(dashboard.sha)
  return (
    <main className={styles.root()}>
      <DashboardScopeInternal dashboard={dashboard}>
        <Sidebar>
          <SidebarHeader>
            <WorkspaceMenu dashboard={dashboard} />
          </SidebarHeader>

          <SidebarTree dashboard={dashboard} />

          <SidebarFooter>
            <div className={styles.meta()}>db.sha: {sha}</div>
          </SidebarFooter>
        </Sidebar>

        <Suspense fallback={<div>Loading...</div>}>
          <Editor dashboard={dashboard} />
        </Suspense>
      </DashboardScopeInternal>
    </main>
  )
}
