import {
  Button,
  DialogTrigger,
  Icon as IconComp,
  Menu,
  MenuItem
} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {useState, type ComponentType} from 'react'
import {IcRoundSearch, IcRoundUnfoldMore} from '../icons.js'
import {useDashboard} from '../store.js'
import type {Dashboard, DashboardWorkspace} from '../store/Dashboard.js'
import {ExplorerBody, ExplorerHeader} from './Explorer.js'
import {LogoShape} from './LogoShape.js'
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
        icon={icon}
        className={styles.WorkspaceMenu.avatar.logo()}
      />
    </span>
  )
}

function SearchPopup() {
  const dashboard = useDashboard()
  const workspace = useAtomValue(dashboard.selectedWorkspace)
  const root = useAtomValue(dashboard.selectedRoot)
  const [explorer] = useState(() =>
    dashboard.explore({workspace, root}, {searchDepth: 'all'})
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
  const color = useAtomValue(workspace.color)
  const icon = useAtomValue(workspace.icon)
  const label = useAtomValue(workspace.label)
  const menu =
    workspaces.length > 1 ? (
      <Menu
        label={
          <Button appearance="plain" className={styles.WorkspaceMenu.trigger()}>
            <span className={styles.WorkspaceMenu.trigger.text()}>{label}</span>
            <IcRoundUnfoldMore />
          </Button>
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
      <WorkspaceAvatar color={color} icon={icon} />

      {menu}

      <DialogTrigger>
        <Button
          size="icon"
          appearance="outline"
          className={styles.WorkspaceMenu.search()}
        >
          <IconComp icon={IcRoundSearch} data-slot="icon" />
        </Button>
        <DashboardModal size="explorer">
          <SearchPopup />
        </DashboardModal>
      </DialogTrigger>
    </div>
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
      <WorkspaceAvatar color={color} icon={icon} size="small" />
      {label}
    </MenuItem>
  )
}
