import {Button, ProgressCircle} from '@alinea/components'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense} from 'react'
import {DashboardScopeInternal} from '../store.js'
import type {Dashboard} from '../store/Dashboard.js'
import css from './AppShell.module.css'
import {Editor} from './Editor.js'
import {SidebarTree} from './SidebarTree.js'
import {ErrorBoundary} from './ui/ErrorBoundary.js'
import {Rail} from './ui/Rail.js'
import {Sidebar, SidebarFooter, SidebarHeader} from './ui/Sidebar.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'

const styles = styler(css)

interface AppShellProps {
  dashboard: Dashboard
}

export function AppShell({dashboard}: AppShellProps) {
  const sha = useAtomValue(dashboard.sha)
  const sync = useSetAtom(dashboard.sync)
  return (
    <main className={styles.AppShell()}>
      <DashboardScopeInternal dashboard={dashboard}>
        <Sidebar>
          <SidebarHeader>
            <WorkspaceMenu dashboard={dashboard} />
          </SidebarHeader>

          <SidebarTree dashboard={dashboard} />

          <SidebarFooter>
            <div>db.sha: {sha}</div>
            <Button onPress={sync}>Sync</Button>
          </SidebarFooter>
        </Sidebar>

        <Suspense
          fallback={
            <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
              <ProgressCircle isIndeterminate aria-label="loading" />
            </Rail>
          }
        >
          <ErrorBoundary>
            <Editor dashboard={dashboard} />
          </ErrorBoundary>
        </Suspense>
      </DashboardScopeInternal>
    </main>
  )
}
