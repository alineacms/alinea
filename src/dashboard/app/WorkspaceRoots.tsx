import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Icon,
  NavRail,
  NavRailContent,
  NavRailFooter,
  NavRailHeader,
  NavRailItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '#/components.js'
import type {Page} from '#/dashboard/atoms/nav.js'
import {rootAtoms, type RootAtoms} from '#/dashboard/atoms/root.js'
import {canLogoutAtom, logoutAtom} from '#/dashboard/atoms/dashboard.js'
import {configAtom, localAtom} from '#/dashboard/atoms/core.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import {workspaceAtom} from '#/dashboard/atoms/config.js'
import {setUserRolesAtom} from '#/dashboard/atoms/auth.js'
import {policyAtom} from '#/dashboard/atoms/user.js'
import {useUser} from '#/dashboard/hooks.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {
  IcBaselineAccountCircle,
  IcOutlineSettings,
  IcRoundLogout,
  IcRoundUnfoldMore
} from '../icons.js'
import {ActivityStatus} from './ActivityStatus.js'
import {AppearanceToggle} from './AppearanceToggle.js'
import {WorkspaceAvatarMenu} from './WorkspaceMenu.js'
import css from './WorkspaceRoots.module.css'

const styles = styler(css)

export interface WorkspaceRootsProps {
  canManageMembers: boolean
  page: Page
  root: RootAtoms
}

export function WorkspaceRoots({
  canManageMembers,
  page,
  root: currentRoot
}: WorkspaceRootsProps) {
  const policy = useAtomValueRaw(policyAtom)
  const workspace = page.workspace!
  const settings = useAtomValueRaw(workspaceAtom(workspace))
  const roots = Object.keys(settings.roots)
    .filter(key => policy.canRead({workspace, root: key}))
    .map(key => rootAtoms(workspace, key))
  return (
    <NavRail aria-label="Workspace roots">
      <NavRailHeader>
        <WorkspaceAvatarMenu page={page} root={currentRoot} />
      </NavRailHeader>
      <NavRailContent>
        {roots.map(root => (
          <WorkspaceRootButton key={root.key} page={page} root={root} />
        ))}
      </NavRailContent>
      <NavRailFooter>
        <ActivityStatus mobileSide="bottom" mobileAlign="end" openOnFail />
        <WorkspaceProfileMenu canManageMembers={canManageMembers} page={page} />
      </NavRailFooter>
    </NavRail>
  )
}

interface WorkspaceRootButtonProps {
  page: Page
  root: ReturnType<typeof rootAtoms>
}

function WorkspaceRootButton({page, root}: WorkspaceRootButtonProps) {
  const icon = useAtomValueRaw(root.icon)
  const label = useAtomValueRaw(root.label)
  const setRoute = useSetAtom(routeAtom)
  const selected = page.root === root.key
  return (
    <NavRailItem
      icon={icon}
      label={label}
      active={selected}
      onClick={() =>
        setRoute({
          workspace: root.workspace,
          root: root.key
        })
      }
    />
  )
}

interface WorkspaceProfileMenuProps {
  canManageMembers: boolean
  page: Page
}

function WorkspaceProfileMenu({
  canManageMembers,
  page
}: WorkspaceProfileMenuProps) {
  const user = useUser()
  const config = useAtomValueRaw(configAtom)
  const isLocal = useAtomValueRaw(localAtom)
  const canLogout = useAtomValueRaw(canLogoutAtom)
  const setUserRoles = useSetAtom(setUserRolesAtom)
  const setRoute = useSetAtom(routeAtom)
  const logout = useSetAtom(logoutAtom)
  if (!user) return null
  const roleEntries = Object.entries(config.roles ?? {})
  const selectedRoles = new Set(user.roles)
  const roleLabel =
    user
      .roles!.map(role => config.roles?.[role]?.label ?? role)
      .filter(Boolean)
      .join(', ') || 'No roles'
  const userName = user.name ?? user.sub

  function toggleRole(role: string, checked: boolean) {
    const roles = new Set(selectedRoles)
    if (checked) roles.add(role)
    else roles.delete(role)
    setUserRoles([...roles])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <Button
              size="icon-lg"
              variant="ghost"
              icon={IcBaselineAccountCircle}
              aria-label={userName}
            />
          </TooltipTrigger>
          <TooltipContent side="right">{userName}</TooltipContent>
        </Tooltip>
      </PopoverTrigger>
      <PopoverContent
        aria-label={userName}
        className={styles.WorkspaceRoots.profile.popover.surface()}
        side="right"
        align="end"
        sideOffset={16}
        style={{padding: '0', boxShadow: 'var(--alinea-shadow-tooltip)'}}
      >
        <ul className={styles.WorkspaceRoots.profile.popover()}>
          <li className={styles.WorkspaceRoots.profile.popover.user()}>
            <Icon
              icon={IcBaselineAccountCircle}
              className={styles.WorkspaceRoots.profile.popover.user.icon()}
            />
            <Text
              weight="medium"
              truncate
              className={styles.WorkspaceRoots.profile.popover.user.title()}
            >
              {userName}
            </Text>
          </li>
          {canManageMembers && (
            <li className={styles.WorkspaceRoots.profile.popover.action()}>
              <Button
                variant="ghost"
                aria-label="Manage users"
                icon={IcOutlineSettings}
                className={styles.WorkspaceRoots.profile.popover.action.button()}
                onClick={() => setRoute({page: 'users'})}
              >
                <Text truncate>Manage users</Text>
              </Button>
            </li>
          )}
          <li className={styles.WorkspaceRoots.profile.popover.item()}>
            <Text as="p">Appearance</Text>
            <AppearanceToggle />
          </li>
          {isLocal && roleEntries.length > 0 && (
            <li className={styles.WorkspaceRoots.profile.popover.item()}>
              <Text as="p">Role</Text>
              <DropdownMenu>
                <DropdownMenuTrigger
                  variant="outline"
                  className={styles.WorkspaceRoots.trigger()}
                >
                  <Text truncate>{roleLabel}</Text>
                  <IcRoundUnfoldMore />
                </DropdownMenuTrigger>
                <DropdownMenuContent aria-label="Development roles">
                  {roleEntries.map(([name, role]) => (
                    <DropdownMenuCheckboxItem
                      key={name}
                      textValue={role.label}
                      checked={selectedRoles.has(name)}
                      onCheckedChange={checked => toggleRole(name, checked)}
                    >
                      {role.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )}
          {canLogout && (
            <li className={styles.WorkspaceRoots.profile.popover.action()}>
              <Button
                variant="ghost"
                aria-label="Logout"
                icon={IcRoundLogout}
                className={styles.WorkspaceRoots.profile.popover.action.button()}
                onClick={logout}
              >
                <Text truncate>Logout</Text>
              </Button>
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
