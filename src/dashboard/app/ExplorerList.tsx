import {Button, Icon, ProgressCircle} from '#/components.js'
import styler from '@alinea/styler'
import {Size} from '@react-stately/virtualizer'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {memo, Suspense} from 'react'
import type {ComponentType} from 'react'
import {
  GridLayout,
  type GridLayoutOptions,
  GridList,
  GridListItem,
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
import type {DashboardEntry, DashboardExplorer} from '../store.js'
import {ExplorerFileCard} from './ExplorerFileCard.js'
import css from './ExplorerList.module.css'

const styles = styler(css)

const rowLayoutOptions: ListLayoutOptions = {
  rowHeight: 80,
  gap: 8,
  padding: 0
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
  const onAction = useSetAtom(explorer.onAction)
  const info = useAtomValue(unwrap(entry.fileInfo))
  return (
    <GridListItem
      id={entry.id}
      textValue={label}
      className={styles.ExplorerItem()}
      onAction={
        // This is not ideal, but I can't see how to cleanly make the setter
        // optional
        explorer.selectionBehavior === 'replace'
          ? onAction.bind(null, entry)
          : undefined
      }
    >
      <Button
        slot="drag"
        aria-label={`Drag ${label}`}
        appearance="plain"
        className={styles.ExplorerItem.drag.handle()}
      >
        <IcRoundDragIndicator />
      </Button>
      <div className={styles.ExplorerItem.card({file: Boolean(info)})}>
        {info ? (
          <ExplorerFileCard file={info} label={label} layout={view} />
        ) : (
          <ExplorerEntryCard
            icon={icon ?? (hasChildren ? IcTwotoneFolder : IcTwotoneDescription)}
            label={label}
            typeLabel={type.label}
            layout={view}
          />
        )}
      </div>
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

export interface ExplorerListProps {
  explorer: DashboardExplorer
}

export function ExplorerList({explorer}: ExplorerListProps) {
  const view = useAtomValue(explorer.view)
  const [isPending, items] = useAtomValue(explorer.items)
  const getItems = useSetAtom(explorer.getItems)
  const [selected, setSelected] = useAtom(explorer.selection)
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
