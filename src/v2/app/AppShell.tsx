import {
  Button,
  DialogTrigger,
  Menu,
  MenuItem,
  Popover,
  ProgressCircle
} from '@alinea/components'
import styler from '@alinea/styler'
import {IcRoundMoreHoriz} from 'alinea/ui/icons/IcRoundMoreHoriz.js'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore.js'
import {Allotment} from 'allotment'
import {useAtomValue} from 'jotai'
import {Suspense} from 'react'
import {
  IcRoundAccountCircle,
  IcRoundBrightness2,
  IcRoundDesktopWindows,
  IcRoundLogout,
  IcRoundWbSunny
} from '../icons.js'
import {DashboardScopeInternal} from '../store.js'
import type {Dashboard} from '../store/Dashboard.js'
import css from './AppShell.module.css'
import {Editor} from './Editor.js'
import {SidebarTree} from './SidebarTree.js'
import {Rail} from './ui/Rail.js'
import {Sidebar, SidebarFooter, SidebarHeader} from './ui/Sidebar.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'

const styles = styler(css)

interface AppShellProps {
  dashboard: Dashboard
}

export function AppShell({dashboard}: AppShellProps) {
  const sha = useAtomValue(dashboard.sha)
  return (
    <main className={styles.root()}>
      <DashboardScopeInternal dashboard={dashboard}>
        <Allotment className={styles.allotment()} snap>
          <Allotment.Pane minSize={196} maxSize={432} preferredSize={272}>
            <Sidebar>
              <SidebarHeader>
                <WorkspaceMenu dashboard={dashboard} />
              </SidebarHeader>

              <SidebarTree dashboard={dashboard} />

              {/* <div>db.sha: {sha}</div> */}
              <SidebarFooter>
                <DialogTrigger>
                  <Button
                    appearance="plain"
                    intent="secondary"
                    className={styles.profile()}
                  >
                    <div className={styles.profile.identity()}>
                      <IcRoundAccountCircle />
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
                    <ul className={styles.profile.popover()}>
                      <li
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 16px'
                        }}
                      >
                        <p>Theme</p>
                        <div className={styles.profile.popover.themeOptions()}>
                          <Button
                            size="icon"
                            appearance="outline"
                            icon={IcRoundDesktopWindows}
                          />
                          <Button
                            size="icon"
                            appearance="outline"
                            icon={IcRoundWbSunny}
                          />
                          <Button
                            size="icon"
                            appearance="outline"
                            icon={IcRoundBrightness2}
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
                              intent="secondary"
                              className={styles.trigger()}
                            >
                              <span className={styles.triggerText()}>
                                Admin
                              </span>
                              <IcRoundUnfoldMore />
                            </Button>
                          }
                        >
                          <MenuItem>Admin</MenuItem>
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
              </SidebarFooter>
            </Sidebar>
          </Allotment.Pane>
          <Allotment.Pane snap={false}>
            <Suspense
              fallback={
                <Rail
                  main
                  style={{alignItems: 'center', justifyContent: 'center'}}
                >
                  <ProgressCircle isIndeterminate aria-label="loading" />
                </Rail>
              }
            >
              <Editor dashboard={dashboard} />
            </Suspense>
          </Allotment.Pane>
        </Allotment>
      </DashboardScopeInternal>
    </main>
  )
}
