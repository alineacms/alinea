import {Button, Menu, MenuItem} from '@alinea/components'
import styler from '@alinea/styler'
import type {ComponentType, CSSProperties} from 'react'
import {IcAlineaLogo} from '../icons.js'
import css from './WorkspaceMenu.module.css'

const styles = styler(css)

export interface WorkspaceMenuItem {
  id: string
  label: string
  icon?: ComponentType
  color?: string
}

interface WorkspaceMenuProps {
  items: Array<WorkspaceMenuItem>
  selectedWorkspace: string
  onSelectWorkspace: (workspace: string) => void
}

function workspaceAvatarStyle(color?: string): CSSProperties {
  return {backgroundColor: color || '#d8e1eb'}
}

export function WorkspaceMenu({
  items,
  selectedWorkspace,
  onSelectWorkspace
}: WorkspaceMenuProps) {
  const selectedItem =
    items.find(item => item.id === selectedWorkspace) ?? items[0] ?? null
  const Icon = selectedItem?.icon ?? IcAlineaLogo

  return (
    <Menu
      label={
        <Button
          appearance="plain"
          className={styles.trigger()}
        >
          <span
            className={styles.triggerAvatar()}
            style={workspaceAvatarStyle(selectedItem?.color)}
          >
            <Icon />
          </span>
          <span className={styles.triggerText()}>
            {selectedItem?.label ?? 'Workspace'}
          </span>
        </Button>
      }
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
