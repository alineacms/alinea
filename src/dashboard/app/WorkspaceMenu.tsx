import {
  Button,
  DialogTrigger,
  Icon,
  Icon as IconComp,
  Menu,
  MenuItem,
  MenuSeparator,
  type PopoverProps
} from '#/components.js'
import type {WorkspaceInternal} from '#/core/Workspace.js'
import {workspaceAtom, workspacesAtom} from '#/dashboard/atoms/config.js'
import {createExplorerAtoms} from '#/dashboard/atoms/explorer.js'
import type {Page} from '#/dashboard/atoms/nav.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import type {RootAtoms} from '#/dashboard/atoms/root.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {Suspense, useState, type ComponentType, type ReactNode} from 'react'
import {Button as AriaButton} from 'react-aria-components'
import {IcOutlineSettings, IcRoundSearch, IcRoundUnfoldMore} from '../icons.js'
import {AlineaLogo} from './AlineaLogo.js'
import {ExplorerBody, ExplorerHeader} from './Explorer.js'
import {ExplorerModal, ExplorerModalSuspense} from './ExplorerModal.js'
import {LogoShape} from './LogoShape.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  useDashboardModal
} from './ui/DashboardModal.js'
import css from './WorkspaceMenu.module.css'

const styles = styler(css)

interface WorkspaceMenuProps {
  canManageMembers: boolean
  page: Page
  root: RootAtoms
  workspace: WorkspaceInternal & {name: string}
}

interface WorkspaceAvatarProps {
  color: string
  icon?: ComponentType
  size?: 'default' | 'large' | 'small'
}

interface WorkspaceSelectorMenuProps {
  ariaLabel: string
  includeUsersLink?: boolean
  label: ReactNode
  page: Page
  popoverProps?: Omit<PopoverProps, 'children'>
}

function WorkspaceAvatar({
  color,
  icon,
  size = 'default'
}: WorkspaceAvatarProps) {
  return (
    <span className={styles.WorkspaceMenu.avatar(size)}>
      <LogoShape
        background={color}
        icon={icon ?? AlineaLogo}
        className={styles.WorkspaceMenu.avatar.logo()}
      />
    </span>
  )
}

export {WorkspaceAvatar}

function WorkspaceSelectorMenu({
  ariaLabel,
  includeUsersLink,
  label,
  page,
  popoverProps
}: WorkspaceSelectorMenuProps) {
  const setRoute = useSetAtom(routeAtom)
  const workspaces = useAtomValueRaw(workspacesAtom)
  if (workspaces.length <= 1 && !includeUsersLink) return label
  return (
    <Menu
      label={label}
      aria-label={ariaLabel}
      selectionMode="single"
      selectedKeys={[page.type === 'users' ? 'users' : page.workspace!]}
      onAction={key => {
        if (key === 'users') {
          setRoute({page: 'users'})
          return
        }
        const workspace = String(key)
        setRoute({workspace, root: undefined})
      }}
      popoverProps={popoverProps}
    >
      {workspaces.map(workspace => (
        <WorkspaceItem key={workspace} workspace={workspace} />
      ))}
      {includeUsersLink && <MenuSeparator />}
      {includeUsersLink && (
        <MenuItem id="users" textValue="Manage users">
          <Icon
            icon={IcOutlineSettings}
            className={styles.WorkspaceMenu.menuItemIcon()}
          />
          Manage users
        </MenuItem>
      )}
    </Menu>
  )
}

interface WorkspaceAvatarMenuProps {
  page: Page
  root: RootAtoms
}

export function WorkspaceAvatarMenu({page, root}: WorkspaceAvatarMenuProps) {
  const workspace = useAtomValueRaw(workspaceAtom(page.workspace!))
  const workspaces = useAtomValueRaw(workspacesAtom)
  const setRoute = useSetAtom(routeAtom)
  const setExplorerLocale = useSetAtom(root.explorer.selectedLocale)
  const avatar = (
    <WorkspaceAvatar
      color={workspace.color}
      icon={workspace.icon}
      size="small"
    />
  )
  if (workspaces.length <= 1) {
    return (
      <div
        className={styles.WorkspaceMenu.avatarTrigger()}
        aria-label={workspace.label}
      >
        {avatar}
      </div>
    )
  }
  function showWorkspaces() {
    setExplorerLocale(page.locale)
    setRoute({page: 'splash'})
  }
  return (
    <Button
      size="icon-nav"
      appearance="plain"
      className={styles.WorkspaceMenu.avatarTrigger()}
      aria-label="Back to workspaces"
      onPress={showWorkspaces}
    >
      {avatar}
    </Button>
  )
}

interface SearchPopupProps {
  initialSearchScope?: 'everything' | 'workspace'
  root: RootAtoms
}

interface GlobalSearchProps {
  children: ReactNode
  initialSearchScope?: 'everything' | 'workspace'
  root: RootAtoms
}

function SearchPopup({initialSearchScope, root}: SearchPopupProps) {
  const modal = useDashboardModal()
  const setRoute = useSetAtom(routeAtom)
  const [explorer] = useState(() =>
    createExplorerAtoms(
      {workspace: root.workspace, root: root.key},
      {
        allowAllWorkspaces: true,
        autoSelectFirstItem: true,
        breadcrumbs: true,
        enableNavigation: true,
        hideResultsUntilSearch: true,
        initialSearchScope,
        mode: 'search',
        rootData: root.data,
        searchDepth: 'all',
        treeItems: locale => root.tree(locale).items,
        onAction(entry) {
          setRoute({
            workspace: entry.workspace,
            root: entry.root,
            entry: entry.id,
            locale: entry.locale ?? undefined
          })
          modal.close()
        }
      }
    )
  )
  const explorerPage = useAtomValueRaw(explorer.page)
  if (!explorerPage)
    return (
      <DashboardModalDialog
        aria-label="Search entries"
        variant="explorer"
        isLoading
      />
    )
  return (
    <DashboardModalDialog aria-label="Search entries" variant="explorer">
      <ExplorerModalSuspense>
        <ExplorerModal>
          <ExplorerHeader
            autoFocusSearch
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
            page={explorerPage}
          />
          <ExplorerBody explorer={explorer} page={explorerPage} />
        </ExplorerModal>
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}

export function GlobalSearch({
  children,
  initialSearchScope,
  root
}: GlobalSearchProps) {
  return (
    <DialogTrigger>
      {children}
      <DashboardModal size="explorer">
        <Suspense
          fallback={
            <DashboardModalDialog
              aria-label="Search entries"
              variant="explorer"
              isLoading
            />
          }
        >
          <SearchPopup initialSearchScope={initialSearchScope} root={root} />
        </Suspense>
      </DashboardModal>
    </DialogTrigger>
  )
}

export function WorkspaceMenu({
  canManageMembers,
  page,
  root,
  workspace
}: WorkspaceMenuProps) {
  const workspaces = useAtomValueRaw(workspacesAtom)
  const menu =
    workspaces.length > 1 ? (
      <WorkspaceSelectorMenu
        page={page}
        ariaLabel="Workspace"
        includeUsersLink={canManageMembers}
        label={
          <AriaButton className={styles.WorkspaceMenu.trigger()}>
            <span className={styles.WorkspaceMenu.trigger.text()}>
              {workspace.label}
            </span>
            <Icon icon={IcRoundUnfoldMore} fontSize={12} />
          </AriaButton>
        }
      />
    ) : (
      <div className={styles.WorkspaceMenu.trigger()}>
        <span className={styles.WorkspaceMenu.trigger.text()}>
          {workspace.label}
        </span>
      </div>
    )
  return (
    <div className={styles.WorkspaceMenu.parent()}>
      {menu}
      <GlobalSearch root={root}>
        <Button
          size="icon"
          appearance="plain"
          className={styles.WorkspaceMenu.search()}
          aria-label="Search entries"
        >
          <IconComp icon={IcRoundSearch} data-slot="icon" />
        </Button>
      </GlobalSearch>
    </div>
  )
}

interface WorkspaceItemProps {
  workspace: string
}

function WorkspaceItem({workspace}: WorkspaceItemProps) {
  const data = useAtomValueRaw(workspaceAtom(workspace))
  return (
    <MenuItem key={workspace} id={workspace} textValue={data.label}>
      {data.label}
    </MenuItem>
  )
}
