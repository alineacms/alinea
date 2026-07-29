import {Button} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense} from 'react'
import {
  navigationAtoms,
  pageAtom,
  workspacesAtom
} from '../atoms/RoutingAtoms.js'
import {currentWorkspaceAtom} from '../atoms/WorkspaceAtoms.js'
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

export function AppShell() {
  const page = useAtomValue(pageAtom)
  const navigationPending = useAtomValue(navigationAtoms.pending)
  return (
    <main
      aria-busy={navigationPending !== undefined}
      className={styles.AppShell()}
      data-navigation-pending={navigationPending ? '' : undefined}
    >
      <AppShellContent page={page} />
    </main>
  )
}

interface AppShellContentProps {
  page: PreparedRoute
}

function AppShellContent({page}: AppShellContentProps) {
  const workspaces = useAtomValue(workspacesAtom)

  if (page.type === 'users' && page.canManageMembers) {
    return (
      <div className={styles.AppShellWorkspace()}>
        <UsersPageSidebar />
        <div className={styles.AppShellContent()}>
          <UsersPage />
        </div>
      </div>
    )
  }

  if (workspaces.length === 0) {
    return <NoWorkspaceAccess canManageMembers={page.canManageMembers} />
  }

  return <AppShellWorkspace page={page} />
}

interface NoWorkspaceAccessProps {
  canManageMembers: boolean
}

function NoWorkspaceAccess({canManageMembers}: NoWorkspaceAccessProps) {
  const setRoute = useSetAtom(navigationAtoms.route)

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

function AppShellWorkspace({page}: AppShellContentProps) {
  const currentWorkspace = useAtomValue(currentWorkspaceAtom)
  assert(currentWorkspace, 'No workspace selected')
  const roots = useAtomValue(currentWorkspace.roots)

  if (roots.length === 0) {
    return (
      <div className={styles.AppShellWorkspace()}>
        <WorkspaceRoots canManageMembers={page.canManageMembers} />
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
      <WorkspaceRoots canManageMembers={page.canManageMembers} />
      <div className={styles.AppShellContent()}>
        <Sidebar>
          <SidebarHeader>
            <WorkspaceMenu canManageMembers={page.canManageMembers} />
          </SidebarHeader>

          <SidebarTree />
        </Sidebar>

        <Suspense fallback={null}>
          <DashboardMeta />
        </Suspense>

        <EditorBoundary page={page} />
      </div>
    </div>
  )
}

function EditorBoundary({page}: AppShellContentProps) {
  return (
    <ErrorBoundary>
      <Editor page={page} />
    </ErrorBoundary>
  )
}
