import {
  Button,
  DialogTrigger,
  Icon as IconComp,
  Menu,
  MenuItem,
  MenuSeparator,
  Modal
} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {useState, type ComponentType} from 'react'
import {IcOutlineSettings, IcRoundSearch, IcRoundUnfoldMore} from '../icons.js'
import {useDashboard} from '../store.js'
import type {Dashboard, DashboardWorkspace} from '../store/Dashboard.js'
import {Explorer} from './Explorer.js'
import {LogoShape} from './LogoShape.js'
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
  const [explorer] = useState(() => dashboard.explore({workspace, root}))

  return (
    <div style={{padding: '8px 12px', borderRadius: '6px'}}>
      <div>
        <Explorer explorer={explorer} />
      </div>
    </div>
  )
}

export function WorkspaceMenu({dashboard}: WorkspaceMenuProps) {
  const [selected, setSelected] = useAtom(dashboard.selectedWorkspace)
  const workspaces = useAtomValue(dashboard.workspaces)
  const workspace = dashboard.workspace(selected)
  const color = useAtomValue(workspace.color)
  const icon = useAtomValue(workspace.icon)
  const label = useAtomValue(workspace.label)
  return (
    <div className={styles.WorkspaceMenu.parent()}>
      <WorkspaceAvatar color={color} icon={icon} />

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
        <MenuSeparator />
        <MenuItem key="manage">
          <IcOutlineSettings />
          Manage members
        </MenuItem>
      </Menu>
      <DialogTrigger>
        <Button
          size="icon"
          appearance="outline"
          className={styles.WorkspaceMenu.search()}
        >
          <IconComp icon={IcRoundSearch} data-slot="icon" />
        </Button>
        <Modal isDismissable>
          <SearchPopup />
        </Modal>
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
