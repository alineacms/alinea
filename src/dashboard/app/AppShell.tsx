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
