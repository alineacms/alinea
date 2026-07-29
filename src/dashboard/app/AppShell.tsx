import {Button, DialogTrigger} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense} from 'react'
import {navigationAtoms, pageAtom} from '../atoms/routing.js'
import type {PreparedRoute} from '../atoms/routing.js'
import {
  currentRootAtom,
  currentWorkspaceAtom,
  type RootAtoms,
  workspacesAtom
} from '../atoms/config.js'
import {IcRoundAdd} from '../icons.js'
import css from './AppShell.module.css'
import {DashboardMeta} from './DashboardMeta.js'
import {Editor} from './Editor.js'
import {CreateEntry} from './modals/CreateEntry.js'
import {SidebarTree} from './SidebarTree.js'
import {DashboardModal} from './ui/DashboardModal.js'
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
  const currentRoot = useAtomValue(currentRootAtom)
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
          {currentRoot && <SidebarCreateEntryButton root={currentRoot} />}
        </Sidebar>

        <Suspense fallback={null}>
          <DashboardMeta />
        </Suspense>

        <EditorBoundary page={page} />
      </div>
    </div>
  )
}

interface SidebarCreateEntryButtonProps {
  root: RootAtoms
}

function SidebarCreateEntryButton({root}: SidebarCreateEntryButtonProps) {
  const canCreate = useAtomValue(root.canCreate)
  if (!canCreate) return null
  return (
    <DialogTrigger>
      <Button
        className={styles.AppShellWorkspace.create()}
        icon={IcRoundAdd}
        intent="secondary"
      >
        Create new
      </Button>
      <DashboardModal>
        <CreateEntry />
      </DashboardModal>
    </DialogTrigger>
  )
}

function EditorBoundary({page}: AppShellContentProps) {
  return (
    <ErrorBoundary>
      <Editor page={page} />
    </ErrorBoundary>
  )
}
