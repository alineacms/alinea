import {
  Button,
  DialogTrigger,
  Menu,
  MenuItem,
  Popover,
  ProgressCircle,
  Tooltip
} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import type {Key} from '@react-types/shared'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  IcBaselineAccountCircle,
  IcRoundBrightness2,
  IcRoundCheck,
  IcRoundDesktopWindows,
  IcRoundLogout,
  IcRoundMoreHoriz,
  IcRoundUnfoldMore,
  IcRoundWarning,
  IcRoundWbSunny
} from '../icons.js'
import {DashboardScopeInternal} from '../store.js'
import type {Dashboard} from '../store/Dashboard.js'
import css from './AppShell.module.css'
import {DashboardMeta} from './DashboardMeta.js'
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
  useAtomValue(dashboard.ensureInitialSync)
  return (
    <main className={styles.AppShell()}>
      <DashboardScopeInternal dashboard={dashboard}>
        <AppShellContent dashboard={dashboard} />
      </DashboardScopeInternal>
    </main>
  )
}

function AppShellContent({dashboard}: AppShellProps) {
  const policyReady = useAtomValue(dashboard.policyReady)
  const workspaces = useAtomValue(dashboard.workspaces)
  const footer = (
    <SidebarFooter className={styles.AppShell.footer()}>
      <MutationQueueStatus dashboard={dashboard} />
      <ProfileMenu dashboard={dashboard} />
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

  if (!policyReady) {
    return (
      <>
        <Sidebar>{footer}</Sidebar>
        <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
          <ProgressCircle isIndeterminate aria-label="loading" />
        </Rail>
      </>
    )
  }

  if (workspaces.length === 0) {
    return (
      <>
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
      </>
    )
  }

  return <AppShellWorkspace dashboard={dashboard} footer={footer} />
}

interface AppShellWorkspaceProps extends AppShellProps {
  footer: ReactNode
}

function AppShellWorkspace({dashboard, footer}: AppShellWorkspaceProps) {
  const currentWorkspace = useAtomValue(dashboard.currentWorkspace)
  assert(currentWorkspace, 'No workspace selected')
  const roots = useAtomValue(currentWorkspace.roots)

  if (roots.length === 0) {
    return (
      <>
        <Sidebar>{footer}</Sidebar>
        <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
          <div className={styles.AppShell.empty()}>
            <h1 className={styles.AppShell.empty.title()}>No root access</h1>
            <p className={styles.AppShell.empty.text()}>
              Your current roles do not grant permission to read any roots in
              this workspace.
            </p>
          </div>
        </Rail>
      </>
    )
  }

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <WorkspaceMenu dashboard={dashboard} />
        </SidebarHeader>

        <SidebarTree dashboard={dashboard} />

        {footer}
      </Sidebar>

      <Suspense
        fallback={
          <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
            <ProgressCircle isIndeterminate aria-label="loading" />
          </Rail>
        }
      >
        <DashboardMeta dashboard={dashboard} />
        <SyncedEditor dashboard={dashboard} />
      </Suspense>
    </>
  )
}

function MutationQueueStatus({dashboard}: AppShellProps) {
  const queue = useAtomValue(dashboard.mutationQueue)
  const retry = useSetAtom(dashboard.retryMutationQueue)
  const discard = useSetAtom(dashboard.discardMutationQueue)
  const [isOpen, setIsOpen] = useState(false)
  const wasFailed = useRef(false)
  const isFailed = queue.failed > 0
  const isSyncing = queue.entries.length > 0
  const label = isFailed
    ? 'Sync failed'
    : isSyncing
      ? 'Syncing changes'
      : 'Content is up to date'

  useEffect(() => {
    if (isFailed && !wasFailed.current) setIsOpen(true)
    wasFailed.current = isFailed
  }, [isFailed])

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Tooltip placement="top" delay={300} tooltip={label}>
        <Button
          size="icon"
          appearance="plain"
          className={styles.AppShell.mutationQueue({
            failed: isFailed,
            syncing: isSyncing
          })}
          aria-label={label}
        >
          {isSyncing && !isFailed ? (
            <ProgressCircle
              isIndeterminate
              aria-label="Syncing changes"
              className={styles.AppShell.mutationQueue.icon()}
            />
          ) : isFailed ? (
            <IcRoundWarning
              aria-hidden="true"
              className={styles.AppShell.mutationQueue.icon()}
            />
          ) : (
            <IcRoundCheck
              aria-hidden="true"
              className={styles.AppShell.mutationQueue.icon()}
            />
          )}
        </Button>
      </Tooltip>
      <Popover
        className={styles.AppShell.mutationQueue.popover.surface()}
        placement="top"
        offset={16}
        style={{
          padding: '0',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)'
        }}
      >
        <div className={styles.AppShell.mutationQueue.popover()}>
          <div className={styles.AppShell.mutationQueue.popover.header()}>
            <h2 className={styles.AppShell.mutationQueue.popover.title()}>
              Sync status
            </h2>
            {isFailed && (
              <div
                className={styles.AppShell.mutationQueue.popover.actions()}
              >
                <Button
                  size="small"
                  appearance="plain"
                  intent="danger"
                  onPress={() => discard()}
                >
                  Discard
                </Button>
                <Button
                  size="small"
                  appearance="outline"
                  intent="danger"
                  onPress={() => retry()}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
          {queue.entries.length === 0 && (
            <p className={styles.AppShell.mutationQueue.popover.message()}>
              All changes are synced.
            </p>
          )}
          {queue.error && (
            <p className={styles.AppShell.mutationQueue.popover.error()}>
              {queue.error}
            </p>
          )}
          <ul className={styles.AppShell.mutationQueue.popover.list()}>
            {queue.entries.map(entry => (
              <li
                key={entry.id}
                className={styles.AppShell.mutationQueue.popover.item()}
              >
                <div
                  className={styles.AppShell.mutationQueue.popover.item.main()}
                >
                  <span
                    className={styles.AppShell.mutationQueue.popover.item.title()}
                  >
                    {formatMutationQueueTitle(entry.mutations)}
                  </span>
                  <span
                    className={styles.AppShell.mutationQueue.popover.item.status(
                      {
                        [entry.status]: true
                      }
                    )}
                  >
                    {formatMutationStatus(entry.status)}
                  </span>
                </div>
                <ul
                  className={styles.AppShell.mutationQueue.popover.item.ops()}
                >
                  {entry.mutations.map((mutation, index) => (
                    <li
                      key={index}
                      className={styles.AppShell.mutationQueue.popover.item.op()}
                    >
                      {formatMutation(mutation)}
                    </li>
                  ))}
                </ul>
                {entry.error && (
                  <p
                    className={styles.AppShell.mutationQueue.popover.item.error()}
                  >
                    {entry.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Popover>
    </DialogTrigger>
  )
}

function formatMutationStatus(status: string) {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'syncing':
      return 'Syncing'
    case 'failed':
      return 'Failed'
    case 'blocked':
      return 'Waiting'
    default:
      return status
  }
}

function formatMutation(mutation: {
  op: string
  title?: string
  locale?: string | null
  status?: string
}) {
  const status = mutation.status ? ` ${formatEntryStatus(mutation.status)}` : ''
  const locale = mutation.locale ? ` (${mutation.locale})` : ''
  switch (mutation.op) {
    case 'create':
      return `Saved${status}${locale}`
    case 'update':
      return `Updated${status}${locale}`
    case 'remove':
      return `Deleted${status}${locale}`
    case 'publish':
      return `Published${status}${locale}`
    case 'unpublish':
      return `Unpublished${locale}`
    case 'archive':
      return `Archived${locale}`
    case 'move':
      return 'Moved'
    case 'uploadFile':
      return 'Uploaded file'
    case 'removeFile':
      return 'Removed file'
    default:
      return mutation.op
  }
}

function formatMutationQueueTitle(
  mutations: Array<{
    title?: string
    op: string
  }>
) {
  const titles = [
    ...new Set(mutations.map(mutation => mutation.title).filter(isString))
  ]
  if (titles.length === 1) return titles[0]
  if (titles.length > 1) return `${titles.length} entries`
  if (mutations.some(mutation => mutation.op === 'uploadFile')) return 'File'
  return 'Content changes'
}

function formatEntryStatus(status: string) {
  switch (status) {
    case 'draft':
      return 'draft'
    case 'published':
      return 'published version'
    case 'archived':
      return 'archived version'
    default:
      return status
  }
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string'
}

function ProfileMenu({dashboard}: AppShellProps) {
  const user = useAtomValue(useMemo(() => unwrap(dashboard.user), [dashboard]))
  const config = useAtomValue(dashboard.config)
  const canLogout = useAtomValue(dashboard.canLogout)
  const [theme, setTheme] = useAtom(dashboard.theme)
  const setUserRoles = useSetAtom(dashboard.setUserRoles)
  const logout = useSetAtom(dashboard.logout)
  if (!user) return null
  const roleEntries = Object.entries(config.roles ?? {})
  const selectedRoles = new Set<Key>(user.roles)
  const roleLabel =
    user.roles
      .map(role => config.roles?.[role]?.label ?? role)
      .filter(Boolean)
      .join(', ') || 'No roles'
  const userName = user.name ?? user.sub

  function handleRoleSelectionChange(keys: 'all' | Set<Key>) {
    if (keys === 'all') return
    setUserRoles([...keys].map(String))
  }

  return (
    <DialogTrigger>
      <Button appearance="plain" className={styles.AppShell.profile()}>
        <div className={styles.AppShell.profile.identity()}>
          <IcBaselineAccountCircle />
          <span className={styles.AppShell.profile.identity.text()}>
            {userName}
          </span>
        </div>
        <IcRoundMoreHoriz />
      </Button>
      <Popover
        className={styles.AppShell.profile.popover.surface()}
        placement="top"
        offset={16}
        style={{
          padding: '0',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)'
        }}
      >
        <ul className={styles.AppShell.profile.popover()}>
          <li className={styles.AppShell.profile.popover.item()}>
            <p className={styles.AppShell.profile.popover.item.label()}>
              Theme
            </p>
            <div className={styles.AppShell.profile.popover.themeOptions()}>
              <Button
                size="icon"
                appearance={theme === 'system' ? 'active' : 'outline'}
                icon={IcRoundDesktopWindows}
                aria-label="Use system theme"
                onPress={() => setTheme('system')}
              />
              <Button
                size="icon"
                appearance={theme === 'light' ? 'active' : 'outline'}
                icon={IcRoundWbSunny}
                aria-label="Use light theme"
                onPress={() => setTheme('light')}
              />
              <Button
                size="icon"
                appearance={theme === 'dark' ? 'active' : 'outline'}
                icon={IcRoundBrightness2}
                aria-label="Use dark theme"
                onPress={() => setTheme('dark')}
              />
            </div>
          </li>
          {dashboard.isLocal && roleEntries.length > 0 && (
            <li className={styles.AppShell.profile.popover.item()}>
              <p className={styles.AppShell.profile.popover.item.label()}>
                Role
              </p>
              <Menu
                aria-label="Development roles"
                selectionMode="multiple"
                selectedKeys={selectedRoles}
                onSelectionChange={handleRoleSelectionChange}
                label={
                  <Button
                    appearance="outline"
                    className={styles.AppShell.trigger()}
                  >
                    <span className={styles.AppShell.trigger.text()}>
                      {roleLabel}
                    </span>
                    <IcRoundUnfoldMore />
                  </Button>
                }
              >
                {roleEntries.map(([name, role]) => (
                  <MenuItem id={name} key={name} textValue={role.label}>
                    {role.label}
                  </MenuItem>
                ))}
              </Menu>
            </li>
          )}
          {canLogout && (
            <li className={styles.AppShell.profile.popover.item()}>
              <p className={styles.AppShell.profile.popover.item.label()}>
                Logout
              </p>
              <Button
                size="icon"
                appearance="outline"
                aria-label="Logout"
                icon={IcRoundLogout}
                onPress={logout}
              />
            </li>
          )}
        </ul>
      </Popover>
    </DialogTrigger>
  )
}

function SyncedEditor({dashboard}: AppShellProps) {
  useAtomValue(dashboard.ensureInitialSync)
  return (
    <ErrorBoundary>
      <Editor dashboard={dashboard} />
    </ErrorBoundary>
  )
}
