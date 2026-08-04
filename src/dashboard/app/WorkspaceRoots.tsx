import {
  Button,
  DialogTrigger,
  Icon,
  Menu,
  MenuItem,
  Popover,
  Tooltip
} from '#/components.js'
import type {Page} from '#/dashboard/atoms/nav.js'
import {rootAtoms} from '#/dashboard/atoms/root.js'
import {dashboardAtoms} from '#/dashboard/atoms/dashboard.js'
import {configAtom, localAtom} from '#/dashboard/atoms/core.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import {workspaceAtoms} from '#/dashboard/atoms/config.js'
import {setUserRolesAtom} from '#/dashboard/atoms/auth.js'
import styler from '@alinea/styler'
import type {Key} from '@react-types/shared'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
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
import {MutationQueueStatus} from './MutationQueueStatus.js'
import {WorkspaceAvatarMenu} from './WorkspaceMenu.js'
import css from './WorkspaceRoots.module.css'

const styles = styler(css)

export interface WorkspaceRootsProps {
  canManageMembers: boolean
  page: Page
}

export function WorkspaceRoots({canManageMembers, page}: WorkspaceRootsProps) {
  const policy = page.auth.policy
  const workspace = page.workspace!
  const settings = useAtomValue(workspaceAtoms(workspace).settingsAtom)
  const roots = Object.keys(settings.roots)
    .filter(key => policy.canRead({workspace, root: key}))
    .map(key => rootAtoms(page, workspace, key, page.locale ?? null))
  return (
    <aside className={styles.WorkspaceRoots()} aria-label="Workspace roots">
      <div className={styles.WorkspaceRoots.workspace()}>
        <WorkspaceAvatarMenu page={page} />
      </div>
      <nav className={styles.WorkspaceRoots.roots()}>
        {roots.map(root => (
          <WorkspaceRootButton key={root.key} page={page} root={root} />
        ))}
      </nav>
      <div className={styles.WorkspaceRoots.footer()}>
        <MutationQueueStatus openOnFail />
        <WorkspaceProfileMenu canManageMembers={canManageMembers} page={page} />
      </div>
    </aside>
  )
}

interface WorkspaceRootButtonProps {
  page: Page
  root: ReturnType<typeof rootAtoms>
}

function WorkspaceRootButton({page, root}: WorkspaceRootButtonProps) {
  const icon = useAtomValue(root.icon)
  const label = useAtomValue(root.label)
  const setRoute = useSetAtom(routeAtom)
  const selected = page.root === root.key
  return (
    <Tooltip placement="right" delay={100} tooltip={label}>
      <Button
        size="icon-nav"
        className={styles.WorkspaceRoots.rootButton()}
        aria-label={label}
        onPress={() =>
          setRoute({
            workspace: root.workspace,
            root: root.key
          })
        }
        data-selected={selected ? '' : undefined}
      >
        {icon && <Icon icon={icon} data-slot="icon" />}
      </Button>
    </Tooltip>
  )
}

interface WorkspaceProfileMenuProps extends WorkspaceRootsProps {}

function WorkspaceProfileMenu({
  canManageMembers,
  page
}: WorkspaceProfileMenuProps) {
  const {user} = page.auth
  const config = useAtomValue(configAtom)
  const isLocal = useAtomValue(localAtom)
  const canLogout = useAtomValue(dashboardAtoms.canLogout)
  const [theme, setTheme] = useAtom(dashboardAtoms.theme)
  const setUserRoles = useSetAtom(setUserRolesAtom)
  const setRoute = useSetAtom(routeAtom)
  const logout = useSetAtom(dashboardAtoms.logout)
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
    if (keys !== 'all') setUserRoles([...keys].map(String))
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
        style={{padding: '0', boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)'}}
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
          {isLocal && roleEntries.length > 0 && (
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
                  className={styles.WorkspaceRoots.profile.popover.action.label()}
                >
                  Logout
                </span>
              </Button>
            </li>
          )}
          {canManageMembers && (
            <li className={styles.WorkspaceRoots.profile.popover.action()}>
              <Button
                appearance="plain"
                aria-label="Manage users"
                className={styles.WorkspaceRoots.profile.popover.action.button()}
                onPress={() => void setRoute({page: 'users'})}
              >
                <Icon icon={IcOutlineSettings} />
                <span
                  className={styles.WorkspaceRoots.profile.popover.action.label()}
                >
                  Manage users
                </span>
              </Button>
            </li>
          )}
        </ul>
      </Popover>
    </DialogTrigger>
  )
}
