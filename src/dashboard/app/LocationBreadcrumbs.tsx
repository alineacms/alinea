import {Button, Icon, Menu, MenuItem} from '#/components.js'
import styler from '@alinea/styler'
import {Atom, useAtomValue} from 'jotai'
import {Dispatch, SetStateAction} from 'react'
import {IcRoundChevronRight, IcRoundMoreHoriz} from '../icons.js'
import {
  DashboardEntry,
  DashboardEntryData,
  DashboardMenuItem,
  ExplorerLocation,
  useDashboard
} from '../store.js'
import css from './LocationBreadcrumbs.module.css'

const styles = styler(css)

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
            <Icon icon={IcRoundMoreHoriz} />
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
  entry: DashboardEntry
  onAction: (id: string) => void
}

function EntryBreadcrumb({entry, onAction}: EntryBreadcrumbProps) {
  const {data} = useAtomValue(entry.data)
  if (!data) return null
  return <LoadedEntryBreadcrumb entry={data} onAction={onAction} />
}

interface LoadedEntryBreadcrumbProps {
  entry: DashboardEntryData
  onAction: (id: string) => void
}

function LoadedEntryBreadcrumb({
  entry,
  onAction
}: LoadedEntryBreadcrumbProps) {
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
  const dashboard = useDashboard()
  const entry = dashboard.entries(parentId)
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
  entry: DashboardEntry
  data: DashboardEntryData
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
          items={dashboard.workspaceMenu}
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
