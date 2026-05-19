import {Button, Icon, ProgressCircle} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {Size} from '@react-stately/virtualizer'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {ComponentType} from 'react'
import {Fragment, memo, Suspense, useMemo, type ReactNode} from 'react'
import {
  GridLayout,
  type GridLayoutOptions,
  GridList,
  GridListItem,
  type Key,
  ListLayout,
  type ListLayoutOptions,
  Virtualizer
} from 'react-aria-components'
import {
  isFileDropItem,
  useDragAndDrop
} from 'react-aria-components/useDragAndDrop'
import {
  IcRoundDragIndicator,
  IcRoundKeyboardArrowRight,
  IcTwotoneDescription,
  IcTwotoneFolder
} from '../icons.js'
import type {
  DashboardEntry,
  DashboardEntryData,
  DashboardExplorer,
  DashboardRoot
} from '../store.js'
import {ExplorerFileCard} from './ExplorerFileCard.js'
import {Surface} from './ui/Surface.js'
import css from './ExplorerList.module.css'

const styles = styler(css)

const rowLayoutOptions: ListLayoutOptions = {
  rowHeight: 80,
  gap: 8,
  padding: 12
}

const cardLayoutOptions: GridLayoutOptions = {
  minItemSize: new Size(240, 196),
  maxItemSize: new Size(320, 196),
  minSpace: new Size(20, 20),
  maxColumns: 5,
  preserveAspectRatio: true
}

interface ExplorerItemProps {
  entry: DashboardEntry
  explorer: DashboardExplorer
}

const ExplorerItem = memo(function ExplorerItem({
  entry,
  explorer
}: ExplorerItemProps) {
  const view = useAtomValue(explorer.view)
  const [, data] = useAtomValue(entry.data)
  if (!data) return <ExplorerLoadingItem entry={entry} view={view} />
  return (
    <ExplorerLoadedItem
      entry={entry}
      data={data}
      explorer={explorer}
      view={view}
    />
  )
})

interface ExplorerLoadingItemProps {
  entry: DashboardEntry
  view: 'card' | 'row'
}

function ExplorerLoadingItem({
  entry,
  view
}: ExplorerLoadingItemProps) {
  return (
    <GridListItem
      id={entry.id}
      textValue="Loading entry"
      className={styles.ExplorerItem({loading: true})}
      aria-label="Loading entry"
    >
      <Surface
        className={styles.ExplorerItem.card()}
        variant={view === 'row' ? 'muted' : undefined}
      >
        <div className={styles.ExplorerEntryCard(view)}>
          <div className={styles.ExplorerEntryCard.top()}>
            <div
              className={styles.ExplorerEntryCard.iconSkeleton()}
              aria-hidden="true"
            />
          </div>
          <div className={styles.ExplorerEntryCard.body()}>
            <div className={styles.ExplorerEntryCard.body.inner()}>
              <div className={styles.ExplorerEntryCard.skeleton({wide: true})} />
              <div className={styles.ExplorerEntryCard.skeleton()} />
            </div>
          </div>
        </div>
      </Surface>
    </GridListItem>
  )
}

interface ExplorerLoadedItemProps {
  entry: DashboardEntry
  data: DashboardEntryData
  explorer: DashboardExplorer
  view: 'card' | 'row'
}

const ExplorerLoadedItem = memo(function ExplorerLoadedItem({
  entry,
  data,
  explorer,
  view
}: ExplorerLoadedItemProps) {
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
  const onAction = useSetAtom(explorer.onAction)
  return (
    <GridListItem
      id={entry.id}
      textValue={label}
      className={styles.ExplorerItem()}
      onDoubleClick={() => onAction(entry)}
    >
      <Button
        slot="drag"
        aria-label={`Drag ${label}`}
        appearance="plain"
        className={styles.ExplorerItem.drag.handle()}
      >
        <IcRoundDragIndicator />
      </Button>
      <Surface
        className={styles.ExplorerItem.card({file: Boolean(info)})}
        variant={view === 'row' ? 'muted' : undefined}
      >
        {info ? (
          <ExplorerFileCard
            file={info}
            label={label}
            layout={view}
            parents={
              <ExplorerEntryParents
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
              <ExplorerEntryParents
                loading={parentsPending && parents === undefined}
                parentIds={parentIds}
                parents={parents ?? []}
              />
            }
            typeLabel={type.label}
            layout={view}
          />
        )}
      </Surface>
    </GridListItem>
  )
})

interface ExplorerEntryCardProps {
  icon?: ComponentType
  label: string
  parents?: ReactNode
  typeLabel: string
  layout: 'card' | 'row'
}

function ExplorerEntryCard({
  icon,
  label,
  parents,
  typeLabel,
  layout
}: ExplorerEntryCardProps) {
  return (
    <div className={styles.ExplorerEntryCard(layout)}>
      <div className={styles.ExplorerEntryCard.top()}>
        {icon && (
          <Icon icon={icon} className={styles.ExplorerEntryCard.icon()} />
        )}
      </div>
      <div className={styles.ExplorerEntryCard.body()}>
        <div className={styles.ExplorerEntryCard.body.inner()}>
          {parents}
          <div className={styles.ExplorerEntryCard.label()}>{label}</div>
          <div className={styles.ExplorerEntryCard.meta()}>{typeLabel}</div>
        </div>
      </div>
    </div>
  )
}

interface ExplorerEntryParentsProps {
  loading: boolean
  parentIds: Array<string>
  parents: Array<DashboardEntry>
}

function ExplorerEntryParents({
  loading,
  parentIds,
  parents
}: ExplorerEntryParentsProps) {
  if (loading && parentIds.length > 0) return <ExplorerEntryParentsLoading />
  if (parents.length === 0) return null
  return (
    <div className={styles.ExplorerEntryParents()}>
      {parents
        .map<ReactNode>(parent => (
          <ExplorerEntryParent key={parent.id} parent={parent} />
        ))
        .reduce((prev, curr, index) => [
          prev,
          <IcRoundKeyboardArrowRight
            aria-hidden
            className={styles.ExplorerEntryParents.separator()}
            key={`separator-${index}`}
          />,
          curr
        ])}
    </div>
  )
}

function ExplorerEntryParentsLoading() {
  return (
    <div className={styles.ExplorerEntryParents()}>
      <span
        className={styles.ExplorerEntryParents.skeleton({wide: true})}
        aria-hidden="true"
      />
      <IcRoundKeyboardArrowRight
        aria-hidden
        className={styles.ExplorerEntryParents.separator()}
      />
      <span
        className={styles.ExplorerEntryParents.skeleton()}
        aria-hidden="true"
      />
    </div>
  )
}

interface ExplorerEntryParentProps {
  parent: DashboardEntry
}

function ExplorerEntryParent({parent}: ExplorerEntryParentProps) {
  const [, data] = useAtomValue(parent.data)
  if (!data) return null
  return <ExplorerLoadedEntryParent parent={data} />
}

interface ExplorerLoadedEntryParentProps {
  parent: DashboardEntryData
}

function ExplorerLoadedEntryParent({parent}: ExplorerLoadedEntryParentProps) {
  const label = useAtomValue(parent.label)
  return <Fragment>{label}</Fragment>
}

interface EmptyResultsProps {
  root: DashboardRoot
}

function EmptyResults({root}: EmptyResultsProps) {
  const icon = useAtomValue(root.icon)
  return (
    <div className={styles.ExplorerList.empty()}>
      <Icon icon={icon} className={styles.ExplorerList.empty.icon()} />
      <div className={styles.ExplorerList.empty.text()}>No results found</div>
    </div>
  )
}

function ExplorerListLoading() {
  return (
    <div className={styles.ExplorerList.loading()}>
      <ProgressCircle isIndeterminate aria-label="Loading entries" />
    </div>
  )
}

export interface ExplorerListProps {
  explorer: DashboardExplorer
}

export function ExplorerList({explorer}: ExplorerListProps) {
  const view = useAtomValue(explorer.view)
  const root = useAtomValue(explorer.root)
  assert(root, 'ExplorerList requires a root')
  const [isPending, loadedItems] = useAtomValue(explorer.items)
  const items = loadedItems ?? []
  const getItems = useSetAtom(explorer.getItems)
  const isMedia = useAtomValue(explorer.isMedia)
  const canUpload = useAtomValue(explorer.canUpload)
  const upload = useSetAtom(explorer.upload)
  const [selected, setSelected] = useAtom(explorer.selection)
  const onAction = useSetAtom(explorer.onAction)
  function onItemAction(key: Key) {
    const entry = items.find(item => item.id === String(key))
    if (entry) onAction(entry)
  }
  const {dragAndDropHooks} = useDragAndDrop<DashboardEntry>({
    acceptedDragTypes: isMedia && canUpload ? 'all' : [],
    getItems,
    getDropOperation(target, _types, allowedOperations) {
      if (!isMedia || !canUpload) return 'cancel'
      if (target.type !== 'root') return 'cancel'
      return allowedOperations.includes('copy') ? 'copy' : 'cancel'
    },
    async onRootDrop(event) {
      const files = await Promise.all(
        event.items.filter(isFileDropItem).map(item => item.getFile())
      )
      if (files.length > 0) await upload(files)
    },
    renderDragPreview(items) {
      return (
        <div className={styles.ExplorerList.drag.preview()}>
          <span className={styles.ExplorerList.drag.preview.label()}>
            {items.length === 1 ? '1 item' : `${items.length} items`}
          </span>
        </div>
      )
    }
  })
  if (isPending && loadedItems === undefined) {
    return (
      <div className={styles.ExplorerList()}>
        <ExplorerListLoading />
      </div>
    )
  }
  return (
    <div className={styles.ExplorerList()}>
      <Suspense fallback={<ExplorerListLoading />}>
        {isPending && (
          <div className={styles.ExplorerList.pending()}>
            <ProgressCircle isIndeterminate aria-label="Pending..." />
          </div>
        )}
        {view === 'card' ? (
          <div className={styles.ExplorerList.viewport()}>
            <Virtualizer layout={GridLayout} layoutOptions={cardLayoutOptions}>
              <GridList
                aria-label="Explorer entries"
                items={items}
                layout="grid"
                className={styles.ExplorerList(view)}
                selectionMode={explorer.selectionMode}
                selectionBehavior={explorer.selectionBehavior}
                dragAndDropHooks={dragAndDropHooks}
                selectedKeys={selected}
                onSelectionChange={setSelected}
                onAction={
                  explorer.selectionBehavior === 'replace'
                    ? onItemAction
                    : undefined
                }
                renderEmptyState={() => <EmptyResults root={root} />}
                style={{display: 'block', width: '100%', height: '100%'}}
              >
                {item => <ExplorerItem entry={item} explorer={explorer} />}
              </GridList>
            </Virtualizer>
          </div>
        ) : (
          <div className={styles.ExplorerList.viewport()}>
            <Virtualizer layout={ListLayout} layoutOptions={rowLayoutOptions}>
              <GridList
                aria-label="Explorer entries"
                items={items}
                layout="stack"
                className={styles.ExplorerList(view)}
                selectionMode={explorer.selectionMode}
                selectionBehavior={explorer.selectionBehavior}
                dragAndDropHooks={dragAndDropHooks}
                selectedKeys={selected}
                onSelectionChange={setSelected}
                onAction={
                  explorer.selectionBehavior === 'replace'
                    ? onItemAction
                    : undefined
                }
                renderEmptyState={() => <EmptyResults root={root} />}
                style={{display: 'block', width: '100%', height: '100%'}}
              >
                {item => <ExplorerItem entry={item} explorer={explorer} />}
              </GridList>
            </Virtualizer>
          </div>
        )}
      </Suspense>
    </div>
  )
}
