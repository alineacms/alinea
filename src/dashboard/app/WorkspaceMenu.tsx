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
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense, useState, type ComponentType, type ReactNode} from 'react'
import {Button as AriaButton} from 'react-aria-components'
import {
  IcOutlineSettings,
  IcRoundSearch,
  IcRoundUnfoldMore
} from '../icons.js'
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
  size?: 'default' | 'small'
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
  const workspaces = useAtomValue(workspacesAtom)
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
}

export function WorkspaceAvatarMenu({page}: WorkspaceAvatarMenuProps) {
  const workspace = useAtomValue(workspaceAtom(page.workspace!))
  return (
    <WorkspaceSelectorMenu
      page={page}
      ariaLabel="Workspace"
      popoverProps={{placement: 'right top', offset: 16}}
      label={
        <Button
          size="icon-nav"
          appearance="plain"
          className={styles.WorkspaceMenu.avatarTrigger()}
          aria-label={workspace.label}
        >
          <WorkspaceAvatar
            color={workspace.color}
            icon={workspace.icon}
            size="small"
          />
        </Button>
      }
    />
  )
}

interface SearchPopupProps {
  page: Page
  root: RootAtoms
}

function SearchPopup({page, root}: SearchPopupProps) {
  const modal = useDashboardModal()
  const setRoute = useSetAtom(routeAtom)
  const [explorer] = useState(() =>
    createExplorerAtoms(
      {workspace: root.workspace, root: root.key},
      {
        autoSelectFirstItem: true,
        breadcrumbs: true,
        enableNavigation: true,
        hideResultsUntilSearch: true,
        mode: 'search',
        rootData: root.data,
        searchDepth: 'all',
        treeItems: root.treeItems,
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
  return (
    <DashboardModalDialog aria-label="Search entries" variant="explorer">
      <ExplorerModalSuspense>
        <ExplorerModal>
          <ExplorerHeader
            autoFocusSearch
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
            locale={page.locale}
          />
          <ExplorerBody explorer={explorer} locale={page.locale} />
        </ExplorerModal>
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}

export function WorkspaceMenu({
  canManageMembers,
  page,
  root,
  workspace
}: WorkspaceMenuProps) {
  const workspaces = useAtomValue(workspacesAtom)
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
      <DialogTrigger>
        <Button
          size="icon"
          appearance="plain"
          className={styles.WorkspaceMenu.search()}
          aria-label="Search entries"
        >
          <IconComp icon={IcRoundSearch} data-slot="icon" />
        </Button>
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
            <SearchPopup page={page} root={root} />
          </Suspense>
        </DashboardModal>
      </DialogTrigger>
    </div>
  )
}

interface WorkspaceItemProps {
  workspace: string
}

function WorkspaceItem({workspace}: WorkspaceItemProps) {
  const data = useAtomValue(workspaceAtom(workspace))
  return (
    <MenuItem key={workspace} id={workspace} textValue={data.label}>
      {data.label}
    </MenuItem>
  )
}
