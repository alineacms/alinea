import {Checkbox, Icon, Surface} from '#/components.js'
import {getWorkspace} from '#/core/Internal.js'
import styler from '@alinea/styler'
import {Size} from '@react-stately/virtualizer'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {ComponentType, ReactNode} from 'react'
import {Fragment, memo, useMemo} from 'react'
import {
  Button as AriaButton,
  type DragAndDropHooks,
  GridLayout,
  type GridLayoutOptions,
  GridList,
  GridListItem,
  type Key,
  Virtualizer
} from 'react-aria-components'
import {
  IcRoundKeyboardArrowRight,
  IcTwotoneDescription,
  IcTwotoneFolder
} from '../icons.js'
import {configAtom} from '../atoms/core.js'
import type {
  DashboardEntry,
  DashboardEntryData,
  DashboardExplorer
} from '../atoms/explorer.js'
import css from './ExplorerCards.module.css'
import {ExplorerFileCard} from './ExplorerFileCard.js'

const styles = styler(css)

const cardLayoutOptions: GridLayoutOptions = {
  minItemSize: new Size(240, 196),
  maxItemSize: new Size(320, 196),
  minSpace: new Size(16, 16),
  maxColumns: 5,
  preserveAspectRatio: true
}

interface ExplorerCardItemProps {
  breadcrumbs: boolean
  entry: DashboardEntry
  includeWorkspace: boolean
  showSelectionControls: boolean
}

const ExplorerCardItem = memo(function ExplorerCardItem({
  breadcrumbs,
  entry,
  includeWorkspace,
  showSelectionControls
}: ExplorerCardItemProps) {
  const {data} = useAtomValue(entry.data)
  if (!data)
    return (
      <ExplorerCardLoadingItem
        entry={entry}
        showSelectionControls={showSelectionControls}
      />
    )
  return (
    <ExplorerCardLoadedItem
      breadcrumbs={breadcrumbs}
      entry={entry}
      data={data}
      includeWorkspace={includeWorkspace}
      showSelectionControls={showSelectionControls}
    />
  )
})

interface ExplorerCardLoadingItemProps {
  entry: DashboardEntry
  showSelectionControls: boolean
}

function ExplorerCardLoadingItem({
  entry,
  showSelectionControls
}: ExplorerCardLoadingItemProps) {
  return (
    <GridListItem
      id={entry.id}
      textValue="Loading entry"
      className={styles.ExplorerCards.item({loading: true})}
      aria-label="Loading entry"
    >
      {showSelectionControls && <ExplorerCardCheckbox label="Loading entry" />}
      <Surface className={styles.ExplorerCards.item.card()}>
        <div className={styles.ExplorerCards.entry()}>
          <div className={styles.ExplorerCards.entry.top()}>
            <div
              className={styles.ExplorerCards.entry.iconSkeleton()}
              aria-hidden="true"
            />
          </div>
          <div className={styles.ExplorerCards.entry.body()}>
            <div className={styles.ExplorerCards.entry.body.inner()}>
              <div
                className={styles.ExplorerCards.entry.skeleton({wide: true})}
              />
              <div className={styles.ExplorerCards.entry.skeleton()} />
            </div>
          </div>
        </div>
      </Surface>
    </GridListItem>
  )
}

interface ExplorerCardLoadedItemProps {
  breadcrumbs: boolean
  entry: DashboardEntry
  data: DashboardEntryData
  includeWorkspace: boolean
  showSelectionControls: boolean
}

const ExplorerCardLoadedItem = memo(function ExplorerCardLoadedItem({
  breadcrumbs,
  entry,
  data,
  includeWorkspace,
  showSelectionControls
}: ExplorerCardLoadedItemProps) {
  const label = useAtomValue(data.label)
  const icon = useAtomValue(data.icon)
  const type = useAtomValue(data.type)
  const hasChildren = useAtomValue(data.hasChildren)
  const info = useAtomValue(
    useMemo(() => unwrap(data.fileInfo, previous => previous ?? null), [data])
  )
  const location = breadcrumbs ? (
    <ExplorerCardLocation
      data={data}
      entry={entry}
      includeWorkspace={includeWorkspace}
    />
  ) : null
  const fallbackIcon = hasChildren ? IcTwotoneFolder : IcTwotoneDescription
  return (
    <GridListItem
      id={entry.id}
      textValue={label}
      className={styles.ExplorerCards.item()}
    >
      {showSelectionControls && <ExplorerCardCheckbox label={label} />}
      <AriaButton
        slot="drag"
        aria-label={`Drag ${label}`}
        className={styles.ExplorerCards.item.drag.handle()}
      />
      <Surface
        className={styles.ExplorerCards.item.card({file: Boolean(info)})}
      >
        {info ? (
          <ExplorerFileCard
            file={info}
            label={label}
            layout="card"
            parents={location}
          />
        ) : (
          <ExplorerEntryCard
            icon={icon ?? fallbackIcon}
            label={label}
            parents={location}
            typeLabel={type.label}
          />
        )}
      </Surface>
    </GridListItem>
  )
})

interface ExplorerCardLocationProps {
  data: DashboardEntryData
  entry: DashboardEntry
  includeWorkspace: boolean
}

function ExplorerCardLocation({
  data,
  entry,
  includeWorkspace
}: ExplorerCardLocationProps) {
  const config = useAtomValue(configAtom)
  const parents = useAtomValue(data.parents)
  const root = useAtomValue(data.root)
  const rootLabel = useAtomValue(root.label)
  const workspace = config.workspaces[entry.workspace]
  const workspaceLabel = workspace
    ? getWorkspace(workspace).label
    : entry.workspace
  return (
    <ExplorerCardParents
      parents={parents}
      rootLabel={rootLabel}
      workspaceLabel={includeWorkspace ? workspaceLabel : undefined}
    />
  )
}

interface ExplorerCardCheckboxProps {
  label: string
}

function ExplorerCardCheckbox({label}: ExplorerCardCheckboxProps) {
  return (
    <Checkbox
      slot="selection"
      className={styles.ExplorerCards.item.checkbox()}
      aria-label={`Select ${label}`}
    />
  )
}

interface ExplorerEntryCardProps {
  icon?: ComponentType
  label: string
  parents?: ReactNode
  typeLabel: string
}

function ExplorerEntryCard({
  icon,
  label,
  parents,
  typeLabel
}: ExplorerEntryCardProps) {
  return (
    <div
      className={styles.ExplorerCards.entry({breadcrumbs: Boolean(parents)})}
    >
      <div className={styles.ExplorerCards.entry.top()}>
        {icon && (
          <Icon icon={icon} className={styles.ExplorerCards.entry.icon()} />
        )}
      </div>
      <div className={styles.ExplorerCards.entry.body()}>
        <div className={styles.ExplorerCards.entry.body.inner()}>
          {parents}
          <div className={styles.ExplorerCards.entry.label()}>{label}</div>
          <div className={styles.ExplorerCards.entry.meta()}>{typeLabel}</div>
        </div>
      </div>
    </div>
  )
}

interface ExplorerCardParentsProps {
  parents: Array<DashboardEntry>
  rootLabel: string
  workspaceLabel?: string
}

function ExplorerCardParents({
  parents,
  rootLabel,
  workspaceLabel
}: ExplorerCardParentsProps) {
  const breadcrumbs: Array<{id: string; value: ReactNode}> = [
    ...(workspaceLabel ? [{id: 'workspace', value: workspaceLabel}] : []),
    ...(rootLabel ? [{id: 'root', value: rootLabel}] : []),
    ...parents.map(parent => ({
      id: `parent-${parent.id}`,
      value: <ExplorerCardParent parent={parent} />
    }))
  ]
  if (breadcrumbs.length === 0) return null
  return (
    <div className={styles.ExplorerCards.parents()}>
      {breadcrumbs.map((breadcrumb, index) => (
        <Fragment key={breadcrumb.id}>
          {index > 0 && (
            <IcRoundKeyboardArrowRight
              aria-hidden
              className={styles.ExplorerCards.parents.separator()}
            />
          )}
          {breadcrumb.value}
        </Fragment>
      ))}
    </div>
  )
}

interface ExplorerCardParentProps {
  parent: DashboardEntry
}

function ExplorerCardParent({parent}: ExplorerCardParentProps) {
  const {data} = useAtomValue(parent.data)
  if (!data) return null
  return <ExplorerCardLoadedParent parent={data} />
}

interface ExplorerCardLoadedParentProps {
  parent: DashboardEntryData
}

function ExplorerCardLoadedParent({parent}: ExplorerCardLoadedParentProps) {
  const label = useAtomValue(parent.label)
  return <Fragment>{label}</Fragment>
}

export interface ExplorerCardsProps {
  dragAndDropHooks: DragAndDropHooks<DashboardEntry>
  explorer: DashboardExplorer
  items: Array<DashboardEntry>
  renderEmptyState: () => ReactNode
  locale: string | null
}

export function ExplorerCards({
  dragAndDropHooks,
  explorer,
  items,
  renderEmptyState,
  locale
}: ExplorerCardsProps) {
  const [selected, setSelected] = useAtom(explorer.selection)
  const resultMode = useAtomValue(explorer.readyResultMode)
  const searchesEverything = useAtomValue(explorer.readySearchesEverything)
  const performAction = useSetAtom(explorer.onAction)
  const selectionMode = explorer.selectionMode
  const hasSelection = selectionMode !== 'none'
  const showSelectionControls = hasSelection && explorer.showSelectionControls
  function onItemAction(key: Key) {
    const entry = items.find(item => item.id === String(key))
    if (!entry) return
    performAction(entry, locale)
  }
  const onAction = explorer.hasRowAction ? onItemAction : undefined
  return (
    <div
      aria-label="Explorer card results"
      className={styles.ExplorerCards.viewport()}
      role="region"
    >
      <Virtualizer layout={GridLayout} layoutOptions={cardLayoutOptions}>
        <GridList
          aria-label="Explorer entries"
          items={items}
          layout="grid"
          className={styles.ExplorerCards()}
          selectionMode={hasSelection ? selectionMode : undefined}
          selectionBehavior={explorer.selectionBehavior}
          disabledBehavior="selection"
          dragAndDropHooks={dragAndDropHooks}
          selectedKeys={hasSelection ? selected : undefined}
          onSelectionChange={hasSelection ? setSelected : undefined}
          onAction={onAction}
          renderEmptyState={renderEmptyState}
          style={{display: 'block', width: '100%', height: '100%'}}
        >
          {item => (
            <ExplorerCardItem
              breadcrumbs={
                explorer.breadcrumbs ||
                resultMode === 'matches' ||
                searchesEverything
              }
              entry={item}
              includeWorkspace={searchesEverything}
              showSelectionControls={showSelectionControls}
            />
          )}
        </GridList>
      </Virtualizer>
    </div>
  )
}
