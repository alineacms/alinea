import {Button, Menu, MenuItem} from '@alinea/components'
import styler from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import type {Dashboard, DashboardWorkspace} from '../dashboard/Dashboard.js'
import {IcAlineaLogo} from '../icons.js'
import css from './WorkspaceMenu.module.css'

const styles = styler(css)

interface WorkspaceMenuProps {
  dashboard: Dashboard
}

export function WorkspaceMenu({dashboard}: WorkspaceMenuProps) {
  const [selected, setSelected] = useAtom(dashboard.selectedWorkspace)
  const workspaces = useAtomValue(dashboard.workspaces)
  const workspace = dashboard.workspace[selected]
  const color = useAtomValue(workspace.color)
  const Icon = useAtomValue(workspace.icon) ?? IcAlineaLogo
  const label = useAtomValue(workspace.label)
  return (
    <Menu
      label={
        <Button appearance="plain" className={styles.trigger()}>
          <span
            className={styles.triggerAvatar()}
            style={{backgroundColor: color}}
          >
            <Icon />
          </span>
          <span className={styles.triggerText()}>{label}</span>
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
          workspace={dashboard.workspace[workspace]}
        />
      ))}
    </Menu>
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
