import {Button, Elevation, Icon, ProgressCircle} from '@alinea/components'
import styler from '@alinea/styler'
import {Size} from '@react-stately/virtualizer'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {memo} from 'react'
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
import {IcRoundDragIndicator} from '../icons.js'
import type {DashboardEntry, DashboardExplorer} from '../store.js'
import css from './ExplorerList.module.css'

const styles = styler(css)

const rowLayoutOptions: ListLayoutOptions = {
  rowHeight: 80,
  gap: 8,
  padding: 0
}

const cardLayoutOptions: GridLayoutOptions = {
  minItemSize: new Size(240, 188),
  maxItemSize: new Size(320, 188),
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
  const label = useAtomValue(entry.label)
  const icon = useAtomValue(entry.icon)
  const type = useAtomValue(entry.type)
  const onAction = useSetAtom(explorer.onAction)
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
      <Elevation className={styles.ExplorerItem.card()}>
        {icon && <Icon icon={icon} className={styles.ExplorerItem.icon()} />}
        <div className={styles.ExplorerItem.body()}>
          <div className={styles.ExplorerItem.label()}>{label}</div>
          <div className={styles.ExplorerItem.meta()}>{type.label}</div>
        </div>
      </Elevation>
    </GridListItem>
  )
})

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
        <Elevation className={styles.ExplorerList.drag.preview()}>
          <span className={styles.ExplorerList.drag.preview.label()}>
            {items.length === 1 ? '1 item' : `${items.length} items`}
          </span>
        </Elevation>
      )
    }
  })
  return (
    <div className={styles.ExplorerList()}>
      {isPending && (
        <div className={styles.ExplorerList.pending()}>
          <ProgressCircle isIndeterminate aria-label="Pending..." />
        </div>
      )}
      {view === 'card' ? (
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
            style={{display: 'block', height: '100%'}}
          >
            {item => <ExplorerItem entry={item} explorer={explorer} />}
          </GridList>
        </Virtualizer>
      ) : (
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
            style={{display: 'block', height: '100%'}}
          >
            {item => <ExplorerItem entry={item} explorer={explorer} />}
          </GridList>
        </Virtualizer>
      )}
    </div>
  )
}
