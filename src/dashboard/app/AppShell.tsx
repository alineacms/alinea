import {Button} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense} from 'react'
import type {DashboardAtoms} from '../atoms/DashboardAtoms.js'
import type {PreparedRoute} from '../atoms/loaders/Route.js'
import css from './AppShell.module.css'
import {DashboardMeta} from './DashboardMeta.js'
import {Editor} from './Editor.js'
import {SidebarTree} from './SidebarTree.js'
import {ErrorBoundary} from './ui/ErrorBoundary.js'
import {Rail} from './ui/Rail.js'
import {Sidebar, SidebarHeader} from './ui/Sidebar.js'
import {UsersPage, UsersPageSidebar} from './UsersPage.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'
import {WorkspaceRoots} from './WorkspaceRoots.js'

const styles = styler(css)

interface AppShellProps {
  dashboard: DashboardAtoms
}

export function AppShell({dashboard}: AppShellProps) {
  const page = useAtomValue(dashboard.page)
  const navigationPending = useAtomValue(dashboard.navigation.pending)
  return (
    <main
      aria-busy={navigationPending !== undefined}
      className={styles.AppShell()}
      data-navigation-pending={navigationPending ? '' : undefined}
    >
      <AppShellContent dashboard={dashboard} page={page} />
    </main>
  )
}

interface AppShellContentProps extends AppShellProps {
  page: PreparedRoute
}

function AppShellContent({dashboard, page}: AppShellContentProps) {
  const workspaces = useAtomValue(dashboard.workspaces)

  if (page.type === 'users' && page.canManageMembers) {
    return (
      <div className={styles.AppShellWorkspace()}>
        <UsersPageSidebar dashboard={dashboard} />
        <div className={styles.AppShellContent()}>
          <UsersPage dashboard={dashboard} />
        </div>
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <NoWorkspaceAccess
        canManageMembers={page.canManageMembers}
        dashboard={dashboard}
      />
    )
  }

  return <AppShellWorkspace dashboard={dashboard} page={page} />
}

interface NoWorkspaceAccessProps {
  canManageMembers: boolean
  dashboard: DashboardAtoms
}

function NoWorkspaceAccess({
  canManageMembers,
  dashboard
}: NoWorkspaceAccessProps) {
  const setRoute = useSetAtom(dashboard.route)

  return (
    <div className={styles.AppShellContent()}>
      <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
        <div className={styles.AppShell.empty()}>
          <h1 className={styles.AppShell.empty.title()}>No workspace access</h1>
          <p className={styles.AppShell.empty.text()}>
            Your current roles do not grant permission to read any workspace.
          </p>
          {canManageMembers && (
            <div className={styles.AppShell.empty.actions()}>
              <Button
                appearance="plain"
                intent="primary"
                onPress={() => void setRoute({page: 'users'})}
              >
                Manage users
              </Button>
            </div>
          )}
        </div>
      </Rail>
    </div>
  )
}

function AppShellWorkspace({dashboard, page}: AppShellContentProps) {
  const currentWorkspace = useAtomValue(dashboard.currentWorkspace)
  assert(currentWorkspace, 'No workspace selected')
  const roots = useAtomValue(currentWorkspace.roots)

  if (roots.length === 0) {
    return (
      <div className={styles.AppShellWorkspace()}>
        <WorkspaceRoots
          dashboard={dashboard}
          canManageMembers={page.canManageMembers}
        />
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
      <WorkspaceRoots
        dashboard={dashboard}
        canManageMembers={page.canManageMembers}
      />
      <div className={styles.AppShellContent()}>
        <Sidebar>
          <SidebarHeader>
            <WorkspaceMenu
              dashboard={dashboard}
              canManageMembers={page.canManageMembers}
            />
          </SidebarHeader>

          <SidebarTree dashboard={dashboard} />
        </Sidebar>

        <Suspense fallback={null}>
          <DashboardMeta />
        </Suspense>

        <EditorBoundary dashboard={dashboard} page={page} />
      </div>
    </div>
  )
}

function EditorBoundary({dashboard, page}: AppShellContentProps) {
  return (
    <ErrorBoundary>
      <Editor dashboard={dashboard} page={page} />
    </ErrorBoundary>
  )
}
