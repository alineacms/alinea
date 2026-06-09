import {Checkbox, Icon} from '#/components.js'
import styler from '@alinea/styler'
import {Size} from '@react-stately/virtualizer'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {ComponentType, ReactNode, UIEvent} from 'react'
import {Fragment, memo, useLayoutEffect, useMemo, useRef} from 'react'
import {
  type DragAndDropHooks,
  GridLayout,
  type GridLayoutOptions,
  GridList,
  GridListItem,
  Button as AriaButton,
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
} from '../store.js'
import css from './ExplorerCards.module.css'
import {ExplorerFileCard} from './ExplorerFileCard.js'
import {Surface} from './ui/Surface.js'

const styles = styler(css)

const cardLayoutOptions: GridLayoutOptions = {
  minItemSize: new Size(240, 196),
  maxItemSize: new Size(320, 196),
  minSpace: new Size(16, 16),
  maxColumns: 5,
  preserveAspectRatio: true
}

interface ExplorerCardItemProps {
  entry: DashboardEntry
}

const ExplorerCardItem = memo(function ExplorerCardItem({
  entry
}: ExplorerCardItemProps) {
  const {data} = useAtomValue(entry.data)
  if (!data) return <ExplorerCardLoadingItem entry={entry} />
  return <ExplorerCardLoadedItem entry={entry} data={data} />
})

interface ExplorerCardLoadingItemProps {
  entry: DashboardEntry
}

function ExplorerCardLoadingItem({entry}: ExplorerCardLoadingItemProps) {
  return (
    <GridListItem
      id={entry.id}
      textValue="Loading entry"
      className={styles.ExplorerCards.item({loading: true})}
      aria-label="Loading entry"
    >
      <ExplorerCardCheckbox label="Loading entry" />
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
  entry: DashboardEntry
  data: DashboardEntryData
}

const ExplorerCardLoadedItem = memo(function ExplorerCardLoadedItem({
  entry,
  data
}: ExplorerCardLoadedItemProps) {
  const label = useAtomValue(data.label)
  const icon = useAtomValue(data.icon)
  const type = useAtomValue(data.type)
  const hasChildren = useAtomValue(data.hasChildren)
  const parentIds = useAtomValue(data.parentIds)
  const [parentsPending, parents] = useAtomValue(data.parentsState)
  const info = useAtomValue(
    useMemo(() => unwrap(data.fileInfo, previous => previous ?? null), [data])
  )
  const fallbackIcon = hasChildren ? IcTwotoneFolder : IcTwotoneDescription
  return (
    <GridListItem
      id={entry.id}
      textValue={label}
      className={styles.ExplorerCards.item()}
    >
      <ExplorerCardCheckbox label={label} />
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
            parents={
              <ExplorerCardParents
                loading={parentsPending && parents === undefined}
                parentIds={parentIds}
                parents={parents ?? []}
              />
            }
          />
        ) : (
          <ExplorerEntryCard
            icon={icon ?? fallbackIcon}
            label={label}
            parents={
              <ExplorerCardParents
                loading={parentsPending && parents === undefined}
                parentIds={parentIds}
                parents={parents ?? []}
              />
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
  loading: boolean
  parentIds: Array<string>
  parents: Array<DashboardEntry>
}

function ExplorerCardParents({
  loading,
  parentIds,
  parents
}: ExplorerCardParentsProps) {
  if (loading && parentIds.length > 0) return <ExplorerCardParentsLoading />
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

function ExplorerCardParentsLoading() {
  return (
    <div className={styles.ExplorerCards.parents()}>
      <span
        className={styles.ExplorerCards.parents.skeleton({wide: true})}
        aria-hidden="true"
      />
      <IcRoundKeyboardArrowRight
        aria-hidden
        className={styles.ExplorerCards.parents.separator()}
      />
      <span
        className={styles.ExplorerCards.parents.skeleton()}
        aria-hidden="true"
      />
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
}

export function ExplorerCards({
  dragAndDropHooks,
  explorer,
  items,
  renderEmptyState
}: ExplorerCardsProps) {
  const [selected, setSelected] = useAtom(explorer.selection)
  const scrollKey = useAtomValue(explorer.scrollKey)
  const scrollPositions = useAtomValue(explorer.scrollPositions)
  const setScrollPositions = useSetAtom(explorer.scrollPositions)
  const onAction = useSetAtom(explorer.onAction)
  const gridListRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const gridList = gridListRef.current
    if (!gridList) return
    const position = scrollPositions[scrollKey]
    gridList.scrollLeft = position?.left ?? 0
    gridList.scrollTop = position?.top ?? 0
  }, [scrollKey, scrollPositions])
  function onItemAction(key: Key) {
    const entry = items.find(item => item.id === String(key))
    if (entry) onAction(entry)
  }
  function onScroll(event: UIEvent<HTMLDivElement>) {
    const {scrollLeft, scrollTop} = event.currentTarget
    setScrollPositions(positions => ({
      ...positions,
      [scrollKey]: {left: scrollLeft, top: scrollTop}
    }))
  }
  return (
    <div className={styles.ExplorerCards.viewport()}>
      <Virtualizer layout={GridLayout} layoutOptions={cardLayoutOptions}>
        <GridList
          aria-label="Explorer entries"
          items={items}
          layout="grid"
          className={styles.ExplorerCards()}
          selectionMode={explorer.selectionMode}
          selectionBehavior="replace"
          dragAndDropHooks={dragAndDropHooks}
          selectedKeys={selected}
          onSelectionChange={setSelected}
          onAction={onItemAction}
          onScroll={onScroll}
          ref={gridListRef}
          renderEmptyState={renderEmptyState}
          style={{display: 'block', width: '100%', height: '100%'}}
        >
          {item => <ExplorerCardItem entry={item} />}
        </GridList>
      </Virtualizer>
    </div>
  )
}
