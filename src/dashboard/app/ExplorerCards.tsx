import {Checkbox, Icon, Surface} from '#/components.js'
import styler from '@alinea/styler'
import {Size} from '@react-stately/virtualizer'
import {useAtom, useAtomValue, useSetAtom, useStore} from 'jotai'
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
  explorer: DashboardExplorer
  showSelectionControls: boolean
}

const ExplorerCardItem = memo(function ExplorerCardItem({
  breadcrumbs,
  entry,
  explorer,
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
      explorer={explorer}
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
  explorer: DashboardExplorer
  showSelectionControls: boolean
}

const ExplorerCardLoadedItem = memo(function ExplorerCardLoadedItem({
  breadcrumbs,
  entry,
  data,
  explorer,
  showSelectionControls
}: ExplorerCardLoadedItemProps) {
  const label = useAtomValue(data.label)
  const icon = useAtomValue(data.icon)
  const type = useAtomValue(data.type)
  const hasChildren = useAtomValue(data.hasChildren)
  const parents = useAtomValue(data.parents)
  const isSelectable = useAtomValue(
    useMemo(() => explorer.isSelectable(entry), [entry, explorer])
  )
  const info = useAtomValue(
    useMemo(() => unwrap(data.fileInfo, previous => previous ?? null), [data])
  )
  const fallbackIcon = hasChildren ? IcTwotoneFolder : IcTwotoneDescription
  return (
    <GridListItem
      id={entry.id}
      textValue={label}
      className={styles.ExplorerCards.item({unselectable: !isSelectable})}
      data-unselectable={!isSelectable || undefined}
      isDisabled={!isSelectable}
    >
      {showSelectionControls && isSelectable && (
        <ExplorerCardCheckbox label={label} />
      )}
      <AriaButton
        slot="drag"
        aria-label={`Drag ${label}`}
        className={styles.ExplorerCards.item.drag.handle()}
      />
      <Surface
        className={styles.ExplorerCards.item.card({file: Boolean(info)})}
      >
        {info ? (
          <ExplorerFileCard file={info} label={label} layout="card" />
        ) : (
          <ExplorerEntryCard
            icon={icon ?? fallbackIcon}
            label={label}
            parents={
              breadcrumbs ? <ExplorerCardParents parents={parents} /> : null
            }
            typeLabel={type.label}
          />
        )}
      </Surface>
    </GridListItem>
  )
})

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
    <div className={styles.ExplorerCards.entry()}>
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
}

function ExplorerCardParents({parents}: ExplorerCardParentsProps) {
  if (parents.length === 0) return null
  return (
    <div className={styles.ExplorerCards.parents()}>
      {parents
        .map<ReactNode>(parent => (
          <ExplorerCardParent key={parent.id} parent={parent} />
        ))
        .reduce((prev, curr, index) => [
          prev,
          <IcRoundKeyboardArrowRight
            aria-hidden
            className={styles.ExplorerCards.parents.separator()}
            key={`separator-${index}`}
          />,
          curr
        ])}
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
  const store = useStore()
  const selectionMode = explorer.selectionMode
  const hasSelection = selectionMode !== 'none'
  const showSelectionControls = hasSelection && explorer.showSelectionControls
  function onItemAction(key: Key) {
    const entry = items.find(item => item.id === String(key))
    if (!entry) return
    const canNavigate =
      resultMode === 'browse' &&
      explorer.supportsInlineExpansion &&
      entry.hasChildren &&
      !store.get(explorer.isSelectable(entry))
    if (explorer.hasRowAction || canNavigate) performAction(entry, locale)
  }
  const onAction =
    explorer.hasRowAction || explorer.supportsInlineExpansion
      ? onItemAction
      : undefined
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
              explorer={explorer}
              showSelectionControls={showSelectionControls}
            />
          )}
        </GridList>
      </Virtualizer>
    </div>
  )
}
