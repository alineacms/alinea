import {
  Button,
  DialogTrigger,
  Menu,
  MenuItem,
  Popover,
  ProgressCircle
} from '#/components.js'
import styler from '@alinea/styler'
import type {Key} from '@react-types/shared'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {Suspense, useMemo} from 'react'
import {
  IcBaselineAccountCircle,
  IcRoundBrightness2,
  IcRoundDesktopWindows,
  IcRoundLogout,
  IcRoundMoreHoriz,
  IcRoundUnfoldMore,
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
        <Sidebar>
          <SidebarHeader>
            <WorkspaceMenu dashboard={dashboard} />
          </SidebarHeader>

          <SidebarTree dashboard={dashboard} />

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
      </DashboardScopeInternal>
    </main>
  )
}

function MutationQueueStatus({dashboard}: AppShellProps) {
  const queue = useAtomValue(dashboard.mutationQueue)
  const retry = useSetAtom(dashboard.retryMutationQueue)
  const discard = useSetAtom(dashboard.discardMutationQueue)
  if (queue.entries.length === 0) return null
  const isFailed = queue.failed > 0
  const label = isFailed ? 'Could not sync changes' : 'Syncing...'
  return (
    <DialogTrigger>
      <Button
        appearance="plain"
        className={styles.AppShell.mutationQueue({failed: isFailed})}
        aria-label={label}
      >
        {!isFailed && (
          <ProgressCircle
            isIndeterminate
            aria-label="Saving changes"
            className={styles.AppShell.mutationQueue.icon()}
          />
        )}
        {isFailed && (
          <span
            aria-hidden="true"
            className={styles.AppShell.mutationQueue.errorIcon()}
          />
        )}
        <span className={styles.AppShell.mutationQueue.text()}>{label}</span>
      </Button>
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
                    className={styles.AppShell.mutationQueue.popover.item.id()}
                  >
                    {shortMutationId(entry.id)}
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

function shortMutationId(id: string) {
  return id.slice(-7)
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
  target?: string
  locale?: string | null
  status?: string
}) {
  const target = mutation.target ? ` ${mutation.target.slice(-7)}` : ''
  const status = mutation.status ? ` (${mutation.status})` : ''
  const locale = mutation.locale ? ` [${mutation.locale}]` : ''
  return `${mutation.op}${target}${status}${locale}`
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
