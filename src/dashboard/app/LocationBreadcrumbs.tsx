import {Button, Icon, Menu, MenuItem} from '#/components.js'
import styler from '@alinea/styler'
import {atom, type Atom, useAtomValue} from 'jotai'
import {Dispatch, SetStateAction} from 'react'
import {IcRoundChevronRight, IcRoundUnfoldMore} from '../icons.js'
import {
  entryAtoms,
  type EntryDataAtoms,
  type EntryAtoms
} from '../atoms/EntryAtoms.js'
import type {
  DashboardMenuItem,
  ExplorerLocation
} from '../atoms/ExplorerAtoms.js'
import {workspacesAtom} from '../atoms/RoutingAtoms.js'
import {workspaceAtoms} from '../atoms/WorkspaceAtoms.js'
import css from './LocationBreadcrumbs.module.css'

const styles = styler(css)

export const workspaceBreadcrumbItemsAtom = atom(get => {
  const workspaces = get(workspacesAtom)
  return workspaces.map(workspace => ({
    id: workspace,
    label: get(workspaceAtoms(workspace).label)
  }))
})

interface BreadcrumbMenuProps {
  label: Atom<string>
  items: Atom<Array<DashboardMenuItem>>
  onSelect: () => void
  onAction: (id: string) => void
}

function BreadcrumbMenu({
  label: labelAtom,
  items: itemsAtom,
  onSelect,
  onAction
}: BreadcrumbMenuProps) {
  const label = useAtomValue(labelAtom)
  const items = useAtomValue(itemsAtom)
  return (
    <span className={styles.LocationBreadcrumbs.item()}>
      <Button
        appearance="plain"
        className={styles.LocationBreadcrumbs.label()}
        onPress={onSelect}
      >
        {label}
      </Button>
      <Menu
        label={
          <Button
            appearance="plain"
            size="icon"
            className={styles.LocationBreadcrumbs.menu()}
            aria-label={`${label} menu`}
          >
            <Icon icon={IcRoundUnfoldMore} />
          </Button>
        }
        aria-label={`${label} menu`}
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
    </span>
  )
}

function BreadcrumbSeparator() {
  return (
    <Icon
      icon={IcRoundChevronRight}
      className={styles.LocationBreadcrumbs.separator()}
    />
  )
}

interface EntryBreadcrumbProps {
  entry: EntryAtoms
  onAction: (id: string) => void
}

function EntryBreadcrumb({entry, onAction}: EntryBreadcrumbProps) {
  const {data} = useAtomValue(entry.data)
  if (!data) return null
  return <LoadedEntryBreadcrumb entry={data} onAction={onAction} />
}

interface LoadedEntryBreadcrumbProps {
  entry: EntryDataAtoms
  onAction: (id: string) => void
}

function LoadedEntryBreadcrumb({entry, onAction}: LoadedEntryBreadcrumbProps) {
  const label = useAtomValue(entry.label)
  return (
    <Button
      appearance="plain"
      className={styles.LocationBreadcrumbs.label()}
      onPress={() => onAction(entry.id)}
    >
      {label}
    </Button>
  )
}

interface ParentBreadcrumbsProps {
  parentId: string
  showLeadingSeparator: boolean
  setParentId: (id: string) => void
}

function ParentBreadcrumbs({
  parentId,
  showLeadingSeparator,
  setParentId
}: ParentBreadcrumbsProps) {
  const entry = entryAtoms(parentId)
  const {data} = useAtomValue(entry.data)
  if (!data) return null
  return (
    <LoadedParentBreadcrumbs
      entry={entry}
      data={data}
      showLeadingSeparator={showLeadingSeparator}
      setParentId={setParentId}
    />
  )
}

interface LoadedParentBreadcrumbsProps {
  entry: EntryAtoms
  data: EntryDataAtoms
  showLeadingSeparator: boolean
  setParentId: (id: string) => void
}

function LoadedParentBreadcrumbs({
  entry,
  data,
  showLeadingSeparator,
  setParentId
}: LoadedParentBreadcrumbsProps) {
  const parents = useAtomValue(data.parents)
  return parents.concat(entry).map((entry, index) => {
    return (
      <span key={entry.id} className={styles.LocationBreadcrumbs.item()}>
        {(showLeadingSeparator || index > 0) && <BreadcrumbSeparator />}
        <EntryBreadcrumb entry={entry} onAction={setParentId} />
      </span>
    )
  })
}

interface LocationBreadcrumbsProps {
  location: ExplorerLocation
  setLocation: Dispatch<SetStateAction<ExplorerLocation>>
  enableWorkspace?: boolean
  enableRoot?: boolean
}

export function LocationBreadcrumbs({
  location,
  setLocation,
  enableWorkspace = false,
  enableRoot = false
}: LocationBreadcrumbsProps) {
  const workspace = workspaceAtoms(location.workspace)
  const roots = useAtomValue(workspace.roots)
  const root = workspace.root(location.root ?? roots[0])
  const setWorkspace = (workspace: string) => {
    setLocation({workspace})
  }
  const setRoot = (root: string) => {
    setLocation(location => ({workspace: location.workspace, root}))
  }
  const selectRoot = () => {
    setLocation(location => ({workspace: location.workspace, root: root.key}))
  }
  const setParentId = (parentId: string) => {
    setLocation(location => ({
      workspace: location.workspace,
      root: location.root,
      parentId
    }))
  }
  const hasRoot = Boolean(root)
  const showRoot = enableRoot && hasRoot
  const hasLeadingSegment = enableWorkspace || showRoot
  return (
    <div className={styles.LocationBreadcrumbs()}>
      {enableWorkspace && (
        <BreadcrumbMenu
          label={workspace.label}
          items={workspaceBreadcrumbItemsAtom}
          onSelect={() => setWorkspace(location.workspace)}
          onAction={setWorkspace}
        />
      )}
      {showRoot && (
        <>
          {enableWorkspace && <BreadcrumbSeparator />}
          <BreadcrumbMenu
            label={root.label}
            items={workspace.rootMenu}
            onSelect={selectRoot}
            onAction={setRoot}
          />
        </>
      )}
      {location.parentId && (
        <ParentBreadcrumbs
          parentId={location.parentId}
          showLeadingSeparator={hasLeadingSegment}
          setParentId={setParentId}
        />
      )}
    </div>
  )
}
