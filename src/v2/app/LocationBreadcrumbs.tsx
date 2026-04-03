import {Button, Menu, MenuItem} from '@alinea/components'
import {Atom, useAtomValue} from 'jotai'
import {Dispatch, SetStateAction} from 'react'
import {
  DashboardEntry,
  DashboardMenuItem,
  ExplorerLocation,
  useDashboard
} from '../store'

interface BreadcrumbMenuProps {
  label: Atom<string>
  items: Atom<Array<DashboardMenuItem>>
  onAction: (id: string) => void
}

function BreadcrumbMenu(props: BreadcrumbMenuProps) {
  const label = useAtomValue(props.label)
  const items = useAtomValue(props.items)
  const onAction = props.onAction
  return (
    <Menu
      label={<Button appearance="plain">{label}</Button>}
      aria-label={label}
      onAction={key => onAction(String(key))}
    >
      {items.map(item => {
        return (
          <MenuItem key={item.id} id={item.id} textValue={item.label}>
            {item.label}
          </MenuItem>
        )
      })}
    </Menu>
  )
}

interface EntryBreacrumbProps {
  entry: DashboardEntry
  onAction: (id: string) => void
}

function EntryBreadcrumb({entry, onAction}: EntryBreacrumbProps) {
  const label = useAtomValue(entry.label)
  return (
    <Button appearance="plain" onPress={() => onAction(entry.id)}>
      {label}
    </Button>
  )
}

interface ParentBreadcrumbsProps {
  parentId: string
  setParentId: (id: string) => void
}

function ParentBreadcrumbs({parentId, setParentId}: ParentBreadcrumbsProps) {
  const dashboard = useDashboard()
  const entry = useAtomValue(dashboard.entries(parentId))
  const parents = useAtomValue(entry.parents)
  return parents.concat(entry).map(entry => {
    return (
      <span key={entry.id}>
        {' > '}
        <EntryBreadcrumb entry={entry} onAction={setParentId} />
      </span>
    )
  })
}

interface LocationBreadcrumbsProps {
  location: ExplorerLocation
  setLocation: Dispatch<SetStateAction<ExplorerLocation>>
}

export function LocationBreadcrumbs({
  location,
  setLocation
}: LocationBreadcrumbsProps) {
  const dashboard = useDashboard()
  const workspace = dashboard.workspace(location.workspace)
  const roots = useAtomValue(workspace.roots)
  const root = workspace.root(location.root ?? roots[0])
  const setWorkspace = (workspace: string) => {
    setLocation({workspace})
  }
  const setRoot = (root: string) => {
    setLocation(location => ({workspace: location.workspace, root}))
  }
  const setParentId = (parentId: string) => {
    setLocation(location => ({
      workspace: location.workspace,
      root: location.root,
      parentId
    }))
  }
  return (
    <div>
      <BreadcrumbMenu
        label={workspace.label}
        items={dashboard.workspaceMenu}
        onAction={setWorkspace}
      />
      &gt;
      {root && (
        <BreadcrumbMenu
          label={root.label}
          items={workspace.rootMenu}
          onAction={setRoot}
        />
      )}
      {location.parentId && (
        <ParentBreadcrumbs
          parentId={location.parentId}
          setParentId={setParentId}
        />
      )}
    </div>
  )
}
