import {Menu, MenuItem} from '@alinea/components'

export interface WorkspaceMenuItem {
  id: string
  label: string
}

interface WorkspaceMenuProps {
  items: Array<WorkspaceMenuItem>
  selectedWorkspace: string
  onSelectWorkspace: (workspace: string) => void
}

export function WorkspaceMenu({
  items,
  selectedWorkspace,
  onSelectWorkspace
}: WorkspaceMenuProps) {
  return (
    <Menu
      label="Workspace"
      aria-label="Workspace"
      selectionMode="single"
      selectedKeys={
        selectedWorkspace ? new Set([selectedWorkspace]) : new Set<string>()
      }
      onAction={function onAction(key) {
        onSelectWorkspace(String(key))
      }}
    >
      {items.map(item => (
        <MenuItem
          key={item.id}
          id={item.id}
          textValue={item.label}
        >
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  )
}
