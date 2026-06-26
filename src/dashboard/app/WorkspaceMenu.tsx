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
import styler from '@alinea/styler'
import {atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import {Suspense, useState, type ComponentType, type ReactNode} from 'react'
import {Button as AriaButton} from 'react-aria-components'
import {
  IcOutlineSettings,
  IcRoundSearch,
  IcRoundUnfoldMore,
  MaterialSymbolsEditSquareOutlineRounded
} from '../icons.js'
import {useDashboard} from '../store.js'
import type {
  Dashboard,
  DashboardRoot,
  DashboardWorkspace
} from '../store/Dashboard.js'
import {AlineaLogo} from './AlineaLogo.js'
import {ExplorerBody, ExplorerHeader} from './Explorer.js'
import {ExplorerModal, ExplorerModalSuspense} from './ExplorerModal.js'
import {LogoShape} from './LogoShape.js'
import {CreateEntry} from './modals/CreateEntry.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  useDashboardModal
} from './ui/DashboardModal.js'
import css from './WorkspaceMenu.module.css'

const styles = styler(css)

interface WorkspaceMenuProps {
  dashboard: Dashboard
}

interface WorkspaceAvatarProps {
  color: string
  icon?: ComponentType
  size?: 'default' | 'small'
}

interface WorkspaceSelectorMenuProps {
  ariaLabel: string
  dashboard: Dashboard
  includeUsersLink?: boolean
  label: ReactNode
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
  dashboard,
  includeUsersLink,
  label,
  popoverProps
}: WorkspaceSelectorMenuProps) {
  const [selected, setSelected] = useAtom(dashboard.selectedWorkspace)
  const route = useAtomValue(dashboard.route)
  const setRoute = useSetAtom(dashboard.route)
  const workspaces = useAtomValue(dashboard.workspaces)
  if (workspaces.length <= 1 && !includeUsersLink) return label
  return (
    <Menu
      label={label}
      aria-label={ariaLabel}
      selectionMode="single"
      selectedKeys={[route.page === 'users' ? 'users' : selected]}
      onAction={key => {
        if (key === 'users') {
          void setRoute({page: 'users'})
          return
        }
        setSelected(String(key))
      }}
      popoverProps={popoverProps}
    >
      {workspaces.map(workspace => (
        <WorkspaceItem
          key={workspace}
          workspace={dashboard.workspace(workspace)}
        />
      ))}
      {includeUsersLink && <MenuSeparator />}
      {includeUsersLink && (
        <MenuItem id="users" textValue="Manage members">
          <Icon
            icon={IcOutlineSettings}
            className={styles.WorkspaceMenu.menuItemIcon()}
          />
          Manage members
        </MenuItem>
      )}
    </Menu>
  )
}

export function WorkspaceAvatarMenu({dashboard}: WorkspaceMenuProps) {
  const selected = useAtomValue(dashboard.selectedWorkspace)
  const workspace = dashboard.workspace(selected)
  const color = useAtomValue(workspace.color)
  const icon = useAtomValue(workspace.icon)
  const label = useAtomValue(workspace.label)
  return (
    <WorkspaceSelectorMenu
      dashboard={dashboard}
      ariaLabel="Workspace"
      popoverProps={{placement: 'right top', offset: 16}}
      label={
        <Button
          size="icon-nav"
          appearance="plain"
          className={styles.WorkspaceMenu.avatarTrigger()}
          aria-label={label}
        >
          <WorkspaceAvatar color={color} icon={icon} size="small" />
        </Button>
      }
    />
  )
}

function SearchPopup() {
  const modal = useDashboardModal()
  const dashboard = useDashboard()
  const workspace = useAtomValue(dashboard.selectedWorkspace)
  const root = useAtomValue(dashboard.selectedRoot)
  const [explorer] = useState(() =>
    dashboard.explore(
      {workspace, root: root ?? undefined},
      {
        mode: 'search',
        onAction: atom(null, (get, set, entry) => {
          const {data} = get(entry.data)
          if (!data) return
          set(dashboard.route, {
            workspace: get(data.workspaceKey),
            root: get(data.rootKey),
            entry: entry.id,
            locale: get(data.sourceLocale) ?? undefined
          })
          modal.close()
        }),
        breadcrumbs: true
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
          />
          <ExplorerBody explorer={explorer} />
        </ExplorerModal>
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}

export function WorkspaceMenu({dashboard}: WorkspaceMenuProps) {
  const workspaces = useAtomValue(dashboard.workspaces)
  const canManageMembers = useAtomValue(dashboard.canManageMembers)
  const selected = useAtomValue(dashboard.selectedWorkspace)
  const workspace = dashboard.workspace(selected)
  const label = useAtomValue(workspace.label)
  const currentRoot = useAtomValue(dashboard.currentRoot)
  const menu =
    workspaces.length > 1 ? (
      <WorkspaceSelectorMenu
        dashboard={dashboard}
        ariaLabel="Workspace"
        includeUsersLink={canManageMembers}
        label={
          <AriaButton className={styles.WorkspaceMenu.trigger()}>
            <span className={styles.WorkspaceMenu.trigger.text()}>{label}</span>
            <Icon icon={IcRoundUnfoldMore} fontSize={12} />
          </AriaButton>
        }
      />
    ) : (
      <div className={styles.WorkspaceMenu.trigger()}>
        <span className={styles.WorkspaceMenu.trigger.text()}>{label}</span>
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
            <SearchPopup />
          </Suspense>
        </DashboardModal>
      </DialogTrigger>
      {currentRoot && <WorkspaceCreateEntryButton root={currentRoot} />}
    </div>
  )
}

interface WorkspaceCreateEntryButtonProps {
  root: DashboardRoot
}

function WorkspaceCreateEntryButton({root}: WorkspaceCreateEntryButtonProps) {
  const canCreate = useAtomValue(root.canCreate)
  if (!canCreate) return null
  return (
    <DialogTrigger>
      <Button
        size="icon"
        icon={MaterialSymbolsEditSquareOutlineRounded}
        aria-label="Create entry"
      />
      <DashboardModal>
        <CreateEntry />
      </DashboardModal>
    </DialogTrigger>
  )
}

interface WorkspaceItemProps {
  workspace: DashboardWorkspace
}

function WorkspaceItem({workspace}: WorkspaceItemProps) {
  const id = workspace.key
  const label = useAtomValue(workspace.label)
  return (
    <MenuItem key={id} id={id} textValue={label}>
      {label}
    </MenuItem>
  )
}
