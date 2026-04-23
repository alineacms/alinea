import {
  Button,
  DialogTrigger,
  Menu,
  MenuItem,
  Popover,
  ProgressCircle
} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {Suspense} from 'react'
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
  const [theme, setTheme] = useAtom(dashboard.theme)
  return (
    <main className={styles.AppShell()}>
      <DashboardScopeInternal dashboard={dashboard}>
        <Sidebar>
          <SidebarHeader>
            <WorkspaceMenu dashboard={dashboard} />
          </SidebarHeader>

          <SidebarTree dashboard={dashboard} />

          <SidebarFooter className={styles.AppShell.footer()}>
            <DialogTrigger>
              <Button appearance="plain" className={styles.AppShell.profile()}>
                <div className={styles.AppShell.profile.identity()}>
                  <IcBaselineAccountCircle />
                  John Doe
                </div>
                <IcRoundMoreHoriz />
              </Button>
              <Popover
                placement="top"
                offset={16}
                style={{
                  padding: '0',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)'
                }}
              >
                <ul className={styles.AppShell.profile.popover()}>
                  <li
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 16px'
                    }}
                  >
                    <p>Theme</p>
                    <div
                      className={styles.AppShell.profile.popover.themeOptions()}
                    >
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
                  <li
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 16px'
                    }}
                  >
                    <p>Role</p>
                    <Menu
                      label={
                        <Button
                          appearance="outline"
                          className={styles.AppShell.trigger()}
                        >
                          <span className={styles.AppShell.trigger.text()}>
                            Admin
                          </span>
                          <IcRoundUnfoldMore />
                        </Button>
                      }
                    >
                      <MenuItem id="admin">Admin</MenuItem>
                    </Menu>
                  </li>
                  <li
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 16px'
                    }}
                  >
                    <p>Logout</p>
                    <Button
                      size="icon"
                      appearance="outline"
                      icon={IcRoundLogout}
                    />
                  </li>
                </ul>
              </Popover>
            </DialogTrigger>
            <div className={styles.AppShell.status()}>
              <span className={styles.AppShell.status.sha()}>
                db.sha: {sha ?? '-'}
              </span>
              <Button appearance="outline" intent="secondary" onPress={sync}>
                Sync
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <Suspense
          fallback={
            <Rail main style={{alignItems: 'center', justifyContent: 'center'}}>
              <ProgressCircle isIndeterminate aria-label="loading" />
            </Rail>
          }
        >
          <SyncedEditor dashboard={dashboard} />
        </Suspense>
      </DashboardScopeInternal>
    </main>
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
