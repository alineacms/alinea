import {useAtom, useAtomValue} from '../AtomHooks.js'
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
import {atom, useSetAtom} from 'jotai'
import {useState, type ComponentType, type ReactNode} from 'react'
import {Button as AriaButton} from 'react-aria-components'
import {IcOutlineSettings, IcRoundSearch, IcRoundUnfoldMore} from '../icons.js'
import {createExplorerAtoms} from '../atoms/explorer.js'
import {
  routeAtom,
  selectedRootAtom,
  selectedWorkspaceAtom
} from '../atoms/routing.js'
import {
  workspaceAtoms,
  workspacesAtom,
  type WorkspaceAtoms
} from '../atoms/config.js'
import {AlineaLogo} from './AlineaLogo.js'
import {ExplorerBody, ExplorerHeader, ExplorerSnapshot} from './Explorer.js'
import {ExplorerModal} from './ExplorerModal.js'
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
  withSearch?: boolean
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
  popoverProps
}: WorkspaceSelectorMenuProps) {
  const [selected, setSelected] = useAtom(selectedWorkspaceAtom)
  const route = useAtomValue(routeAtom)
  const setRoute = useSetAtom(routeAtom)
  const workspaces = useAtomValue(workspacesAtom)
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
        <WorkspaceItem key={workspace} workspace={workspaceAtoms(workspace)} />
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

export function WorkspaceAvatarMenu({canManageMembers}: WorkspaceMenuProps) {
  const selected = useAtomValue(selectedWorkspaceAtom)
  const workspace = workspaceAtoms(selected)
  const {color, icon, label} = useAtomValue(workspace.settings)
  return (
    <WorkspaceSelectorMenu
      ariaLabel="Workspace"
      includeUsersLink={canManageMembers}
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
  const workspace = useAtomValue(selectedWorkspaceAtom)
  const root = useAtomValue(selectedRootAtom)
  const [explorer] = useState(() =>
    createExplorerAtoms(
      {workspace, root: root ?? undefined},
      {
        actionOnPress: true,
        mode: 'search',
        onAction: atom(null, (get, set, entry) => {
          const {data} = get(entry.data)
          if (!data) return
          set(routeAtom, {
            workspace: get(data.entryData).workspace,
            root: get(data.entryData).root,
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
      <ExplorerSnapshot explorer={explorer}>
        {items => (
          <ExplorerModal>
            <ExplorerHeader
              autoFocusSearch
              controls={<DashboardModalCloseButton />}
              explorer={explorer}
              items={items}
            />
            <ExplorerBody explorer={explorer} items={items} />
          </ExplorerModal>
        )}
      </ExplorerSnapshot>
    </DashboardModalDialog>
  )
}

export function WorkspaceMenu({
  canManageMembers,
  withSearch = true
}: WorkspaceMenuProps) {
  const workspaces = useAtomValue(workspacesAtom)
  const selected = useAtomValue(selectedWorkspaceAtom)
  const workspace = workspaceAtoms(selected)
  const label = useAtomValue(workspace.settings).label
  const menu =
    workspaces.length > 1 ? (
      <WorkspaceSelectorMenu
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

      {withSearch && (
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
            <SearchPopup />
          </DashboardModal>
        </DialogTrigger>
      )}
    </div>
  )
}

interface WorkspaceItemProps {
  workspace: WorkspaceAtoms
}

export function WorkspaceItem({workspace}: WorkspaceItemProps) {
  const id = workspace.key
  const label = useAtomValue(workspace.settings).label
  return (
    <MenuItem key={id} id={id} textValue={label}>
      {label}
    </MenuItem>
  )
}
