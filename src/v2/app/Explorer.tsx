import {Button, Menu, MenuItem, SearchField} from '@alinea/components'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {Suspense} from 'react'
import {DashboardExplorer, DashboardMenuItem} from '../store.js'

interface BreadcrumbMenuProps {
  label: string
  items: Array<DashboardMenuItem>
  onAction: (id: string) => void
}

function BreadcrumbMenu({label, items, onAction}: BreadcrumbMenuProps) {
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

interface BreadcrumbsProps {
  explorer: DashboardExplorer
}

interface ParentBreadcrumbsProps {
  explorer: DashboardExplorer
}

function ParentBreadcrumbs({explorer}: ParentBreadcrumbsProps) {
  const parents = useAtomValue(explorer.parentBreadcrumbs)
  return parents.map(parent => {
    return <span key={parent.id}>&gt; {parent.label}</span>
  })
}

function Breadcrumbs({explorer}: BreadcrumbsProps) {
  const workspace = useAtomValue(explorer.workspace)
  const root = useAtomValue(explorer.root)
  const workspaces = useAtomValue(explorer.workspaces)
  const roots = useAtomValue(explorer.roots)
  const setWorkspace = useSetAtom(explorer.setWorkspace)
  const setRoot = useSetAtom(explorer.setRoot)
  const workspaceLabel = useAtomValue(workspace.label)
  const rootLabel = useAtomValue(root.label)
  return (
    <div>
      <BreadcrumbMenu
        label={workspaceLabel}
        items={workspaces}
        onAction={setWorkspace}
      />
      &gt;
      <BreadcrumbMenu label={rootLabel} items={roots} onAction={setRoot} />
      <Suspense>
        <ParentBreadcrumbs explorer={explorer} />
      </Suspense>
    </div>
  )
}

export interface ExplorerProps {
  explorer: DashboardExplorer
}

interface ExplorerSearchProps {
  explorer: DashboardExplorer
}

function ExplorerSearch({explorer}: ExplorerSearchProps) {
  const [search, setSearch] = useAtom(explorer.search)
  return (
    <SearchField
      label="Search"
      placeholder="Search..."
      value={search}
      onChange={setSearch}
    />
  )
}

export function Explorer({explorer}: ExplorerProps) {
  return (
    <div>
      <Breadcrumbs explorer={explorer} />
      <div>
        <ExplorerSearch explorer={explorer} />
      </div>

      <div>rows</div>
    </div>
  )
}
