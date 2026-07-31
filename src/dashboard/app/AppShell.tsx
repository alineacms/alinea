import styler from '@alinea/styler'
import {HTMLProps} from 'react'
import css from './AppShell.module.css'

const styles = styler(css)

export function AppShell(props: HTMLProps<HTMLElement>) {
  return <main className={styles.AppShell()} {...props} />
}

export function AppShellInner(props: HTMLProps<HTMLDivElement>) {
  return <div className={styles.AppShellWorkspace()} {...props} />
}

export function AppShellContent(props: HTMLProps<HTMLDivElement>) {
  return <div className={styles.AppShellContent()} {...props} />
}

/*
interface AppShellProps {
  dashboard: Dashboard
}

export const appShellAtom = atom(async get => {
  await get(policyReady)

  const workspaces = get(workspacesAtom)
  const route = get(routeAtom)
  const policy = get(policyAtom)

  if (route.page === 'users' && policy.canManageMembers()) {
    return (
      <div className={styles.AppShellWorkspace()}>
        <UsersPageSidebar />
        <div className={styles.AppShellContent()}>
          <UsersPage />
        </div>
      </div>
    )
  }

  return <main className={styles.AppShell()}>{workspaces.map(String)}</main>
})

function AppShellContent({dashboard}: AppShellProps) {
  const workspaces = useAtomValue(dashboard.workspaces)
  const route = useAtomValue(dashboard.route)
  const canManageMembers = useAtomValue(dashboard.canManageMembers)

  if (route.page === 'users' && canManageMembers) {
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
        canManageMembers={canManageMembers}
        dashboard={dashboard}
      />
    )
  }

  return <AppShellWorkspace dashboard={dashboard} />
}

interface NoWorkspaceAccessProps {
  canManageMembers: boolean
  dashboard: Dashboard
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
*/
