import {
  Button,
  DialogTrigger,
  Icon,
  Icon as IconComp,
  Menu,
  MenuItem
} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {useState, type ComponentType} from 'react'
import {Button as AriaButton} from 'react-aria-components'
import {
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
import {LogoShape} from './LogoShape.js'
import {CreateEntry} from './modals/CreateEntry.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  DashboardModalExplorer
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

function SearchPopup() {
  const dashboard = useDashboard()
  const workspace = useAtomValue(dashboard.selectedWorkspace)
  const root = useAtomValue(dashboard.selectedRoot)
  const [explorer] = useState(() =>
    dashboard.explore(
      {workspace, root: root ?? undefined},
      {searchDepth: 'all'}
    )
  )

  return (
    <DashboardModalDialog aria-label="Search entries" variant="explorer">
      <DashboardModalExplorer>
        <ExplorerHeader
          controls={<DashboardModalCloseButton />}
          explorer={explorer}
        />
        <ExplorerBody explorer={explorer} />
      </DashboardModalExplorer>
    </DashboardModalDialog>
  )
}

export function WorkspaceMenu({dashboard}: WorkspaceMenuProps) {
  const [selected, setSelected] = useAtom(dashboard.selectedWorkspace)
  const workspaces = useAtomValue(dashboard.workspaces)
  const workspace = dashboard.workspace(selected)
  const label = useAtomValue(workspace.label)
  const currentRoot = useAtomValue(dashboard.currentRoot)
  const menu =
    workspaces.length > 1 ? (
      <Menu
        label={
          <AriaButton className={styles.WorkspaceMenu.trigger()}>
            <span className={styles.WorkspaceMenu.trigger.text()}>{label}</span>
            <Icon icon={IcRoundUnfoldMore} fontSize={12} />
          </AriaButton>
        }
        aria-label="Workspace"
        selectionMode="single"
        selectedKeys={[selected]}
        onAction={key => setSelected(String(key))}
      >
        {workspaces.map(workspace => (
          <WorkspaceItem
            key={workspace}
            workspace={dashboard.workspace(workspace)}
          />
        ))}
      </Menu>
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
          <SearchPopup />
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
  const color = useAtomValue(workspace.color)
  const icon = useAtomValue(workspace.icon)
  return (
    <MenuItem key={id} id={id} textValue={label}>
      <WorkspaceAvatar color={color} icon={icon} />
      {label}
    </MenuItem>
  )
}
