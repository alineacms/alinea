import {
  Button,
  DialogTrigger,
  Icon,
  Menu,
  MenuItem,
  Popover,
  Tooltip
} from '#/components.js'
import styler from '@alinea/styler'
import type {Key} from '@react-types/shared'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {useMemo} from 'react'
import {
  IcBaselineAccountCircle,
  IcOutlineSettings,
  IcRoundBrightness2,
  IcRoundDesktopWindows,
  IcRoundLogout,
  IcRoundMoreHoriz,
  IcRoundUnfoldMore,
  IcRoundWbSunny
} from '../icons.js'
import type {Dashboard, DashboardRoot} from '../store/Dashboard.js'
import {MutationQueueStatus} from './MutationQueueStatus.js'
import {WorkspaceAvatarMenu} from './WorkspaceMenu.js'
import css from './WorkspaceRoots.module.css'

const styles = styler(css)

interface WorkspaceRootsProps {
  dashboard: Dashboard
}

export function WorkspaceRoots({dashboard}: WorkspaceRootsProps) {
  const selected = useAtomValue(dashboard.selectedWorkspace)
  const workspace = dashboard.workspace(selected)
  const roots = useAtomValue(workspace.roots).map(root => workspace.root(root))
  return (
    <aside className={styles.WorkspaceRoots()} aria-label="Workspace roots">
      <div className={styles.WorkspaceRoots.workspace()}>
        <WorkspaceAvatarMenu dashboard={dashboard} />
      </div>
      <nav className={styles.WorkspaceRoots.roots()}>
        {roots.map(root => (
          <WorkspaceRootButton key={root.key} root={root} />
        ))}
      </nav>
      <div className={styles.WorkspaceRoots.footer()}>
        <MutationQueueStatus dashboard={dashboard} openOnFail />
        <WorkspaceProfileMenu dashboard={dashboard} />
      </div>
    </aside>
  )
}

interface WorkspaceRootButtonProps {
  root: DashboardRoot
}

function WorkspaceRootButton({root}: WorkspaceRootButtonProps) {
  const icon = useAtomValue(root.icon)
  const label = useAtomValue(root.label)
  const [selected, setSelected] = useAtom(root.selected)
  return (
    <Tooltip placement="right" delay={100} tooltip={label}>
      <Button
        size="icon-nav"
        //appearance={selected ? 'active' : 'plain'}
        className={styles.WorkspaceRoots.rootButton()}
        aria-label={label}
        onPress={() => setSelected(true)}
        data-selected={selected ? '' : undefined}
      >
        {icon && <Icon icon={icon} data-slot="icon" />}
      </Button>
    </Tooltip>
  )
}

function WorkspaceProfileMenu({dashboard}: WorkspaceRootsProps) {
  const user = useAtomValue(useMemo(() => unwrap(dashboard.user), [dashboard]))
  const config = useAtomValue(dashboard.config)
  const canLogout = useAtomValue(dashboard.canLogout)
  const [theme, setTheme] = useAtom(dashboard.theme)
  const setUserRoles = useSetAtom(dashboard.setUserRoles)
  const setRoute = useSetAtom(dashboard.route)
  const logout = useSetAtom(dashboard.logout)
  if (!user) return null
  const roleEntries = Object.entries(config.roles ?? {})
  const selectedRoles = new Set<Key>(user.roles)
  const roleLabel =
    user
      .roles!.map(role => config.roles?.[role]?.label ?? role)
      .filter(Boolean)
      .join(', ') || 'No roles'
  const userName = user.name ?? user.sub

  function handleRoleSelectionChange(keys: 'all' | Set<Key>) {
    if (keys === 'all') return
    setUserRoles([...keys].map(String))
  }

  return (
    <DialogTrigger>
      <Tooltip placement="right" delay={100} tooltip={userName}>
        <Button
          size="icon-nav"
          appearance="plain"
          className={styles.WorkspaceRoots.profile()}
          aria-label={userName}
        >
          <Icon data-slot="icon" icon={IcBaselineAccountCircle} />
        </Button>
      </Tooltip>
      <Popover
        className={styles.WorkspaceRoots.profile.popover.surface()}
        placement="right bottom"
        offset={16}
        style={{
          padding: '0',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)'
        }}
      >
        <ul className={styles.WorkspaceRoots.profile.popover()}>
          <li className={styles.WorkspaceRoots.profile.popover.user()}>
            <span className={styles.WorkspaceRoots.profile.popover.user.icon()}>
              <IcBaselineAccountCircle />
            </span>
            <span
              className={styles.WorkspaceRoots.profile.popover.user.title()}
            >
              {userName}
            </span>
            <IcRoundMoreHoriz />
          </li>
          <li className={styles.WorkspaceRoots.profile.popover.item()}>
            <p className={styles.WorkspaceRoots.profile.popover.item.label()}>
              Theme
            </p>
            <div
              className={styles.WorkspaceRoots.profile.popover.themeOptions()}
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
          {dashboard.isLocal && roleEntries.length > 0 && (
            <li className={styles.WorkspaceRoots.profile.popover.item()}>
              <p className={styles.WorkspaceRoots.profile.popover.item.label()}>
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
                    className={styles.WorkspaceRoots.trigger()}
                  >
                    <span className={styles.WorkspaceRoots.trigger.text()}>
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
            <li className={styles.WorkspaceRoots.profile.popover.action()}>
              <Button
                appearance="plain"
                aria-label="Logout"
                className={styles.WorkspaceRoots.profile.popover.action.button()}
                onPress={logout}
              >
                <Icon icon={IcRoundLogout} />
                <span
                  className={
                    styles.WorkspaceRoots.profile.popover.action.label()
                  }
                >
                  Logout
                </span>
              </Button>
            </li>
          )}
          <li className={styles.WorkspaceRoots.profile.popover.action()}>
            <Button
              appearance="plain"
              aria-label="Manage members"
              className={styles.WorkspaceRoots.profile.popover.action.button()}
              onPress={() => void setRoute({page: 'users'})}
            >
              <Icon icon={IcOutlineSettings} />
              <span
                className={styles.WorkspaceRoots.profile.popover.action.label()}
              >
                Manage members
              </span>
            </Button>
          </li>
        </ul>
      </Popover>
    </DialogTrigger>
  )
}
