import {Button, Icon, ProgressCircle} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {Size} from '@react-stately/virtualizer'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {ComponentType} from 'react'
import {memo, Suspense} from 'react'
import {
  GridLayout,
  type GridLayoutOptions,
  GridList,
  GridListItem,
  type Key,
  ListLayout,
  type ListLayoutOptions,
  useDragAndDrop,
  Virtualizer
} from 'react-aria-components'
import {
  IcRoundDragIndicator,
  IcTwotoneDescription,
  IcTwotoneFolder
} from '../icons.js'
import type {
  DashboardEntry,
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
  const label = useAtomValue(entry.label)
  const icon = useAtomValue(entry.icon)
  const type = useAtomValue(entry.type)
  const hasChildren = useAtomValue(entry.hasChildren)
  const info = useAtomValue(unwrap(entry.fileInfo))
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
          <ExplorerFileCard file={info} label={label} layout={view} />
        ) : (
          <ExplorerEntryCard
            icon={icon ?? fallbackIcon}
            label={label}
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
  typeLabel: string
  layout: 'card' | 'row'
}

function ExplorerEntryCard({
  icon,
  label,
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
          <div className={styles.ExplorerEntryCard.label()}>{label}</div>
          <div className={styles.ExplorerEntryCard.meta()}>{typeLabel}</div>
        </div>
      </div>
    </div>
  )
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
  const [selected, setSelected] = useAtom(explorer.selection)
  const onAction = useSetAtom(explorer.onAction)
  function onItemAction(key: Key) {
    const entry = items.find(item => item.id === String(key))
    if (entry) onAction(entry)
  }
  const {dragAndDropHooks} = useDragAndDrop<DashboardEntry>({
    getItems,
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
  return (
    <div className={styles.ExplorerList()}>
      <Suspense
        fallback={<ProgressCircle isIndeterminate aria-label="Loading..." />}
      >
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
