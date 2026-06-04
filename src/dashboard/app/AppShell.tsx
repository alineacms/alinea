import {ProgressCircle} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {Suspense} from 'react'
import {DashboardScopeInternal} from '../store.js'
import type {Dashboard} from '../store/Dashboard.js'
import css from './AppShell.module.css'
import {DashboardMeta} from './DashboardMeta.js'
import {Editor} from './Editor.js'
import {MutationQueueStatus} from './MutationQueueStatus.js'
import {SidebarTree} from './SidebarTree.js'
import {ErrorBoundary} from './ui/ErrorBoundary.js'
import {Rail} from './ui/Rail.js'
import {Sidebar, SidebarFooter, SidebarHeader} from './ui/Sidebar.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'
import {WorkspaceRoots} from './WorkspaceRoots.js'

const styles = styler(css)

interface AppShellProps {
  dashboard: Dashboard
}

export function AppShell({dashboard}: AppShellProps) {
  useAtomValue(dashboard.initialContentAvailable)
  return (
    <main className={styles.AppShell()}>
      <DashboardScopeInternal dashboard={dashboard}>
        <AppShellContent dashboard={dashboard} />
      </DashboardScopeInternal>
    </main>
  )
}

function AppShellContent({dashboard}: AppShellProps) {
  const workspaces = useAtomValue(dashboard.workspaces)
  const footer = (
    <SidebarFooter className={styles.AppShell.footer()}>
      <MutationQueueStatus dashboard={dashboard} openOnFail />
      {/*<div className={styles.AppShell.status()}>
              <span className={styles.AppShell.status.sha()}>
                db.sha: {sha ?? '-'}
              </span>
              <Button appearance="outline" intent="secondary" onPress={sync}>
                Sync
              </Button>
            </div>*/}
    </SidebarFooter>
  )

  if (workspaces.length === 0) {
    return (
      <div className={styles.AppShellContent()}>
        <Sidebar>{footer}</Sidebar>
        <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
          <div className={styles.AppShell.empty()}>
            <h1 className={styles.AppShell.empty.title()}>
              No workspace access
            </h1>
            <p className={styles.AppShell.empty.text()}>
              Your current roles do not grant permission to read any workspace.
            </p>
          </div>
        </Rail>
      </div>
    )
  }

  return <AppShellWorkspace dashboard={dashboard} />
}

function AppShellWorkspace({dashboard}: AppShellProps) {
  const currentWorkspace = useAtomValue(dashboard.currentWorkspace)
  assert(currentWorkspace, 'No workspace selected')
  const roots = useAtomValue(currentWorkspace.roots)

  if (roots.length === 0) {
    return (
      <div className={styles.AppShellWorkspace()}>
        <WorkspaceRoots dashboard={dashboard} />
        <div className={styles.AppShellContent()}>
          <Sidebar />
          <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
            <div className={styles.AppShell.empty()}>
              <h1 className={styles.AppShell.empty.title()}>No root access</h1>
              <p className={styles.AppShell.empty.text()}>
                Your current roles do not grant permission to read any roots in
                this workspace.
              </p>
            </div>
          </Rail>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.AppShellWorkspace()}>
      <WorkspaceRoots dashboard={dashboard} />
      <div className={styles.AppShellContent()}>
        <Sidebar>
          <SidebarHeader>
            <WorkspaceMenu dashboard={dashboard} />
          </SidebarHeader>

          <SidebarTree dashboard={dashboard} />
        </Sidebar>

        <Suspense fallback={null}>
          <DashboardMeta dashboard={dashboard} />
        </Suspense>

        <EditorBoundary dashboard={dashboard} />
      </div>
    </div>
  )
}

function EditorBoundary({dashboard}: AppShellProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<EditorLoading />}>
        <Editor dashboard={dashboard} />
      </Suspense>
    </ErrorBoundary>
  )
}

function EditorLoading() {
  return (
    <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
      <ProgressCircle isIndeterminate aria-label="Loading editor" />
    </Rail>
  )
}
