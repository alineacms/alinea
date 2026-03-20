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
  const setParent = useSetAtom(explorer.parent)
  return (
    <GridListItem
      id={entry.id}
      textValue={label}
      className={styles.item()}
      onAction={() => {
        if (entry.hasChildren) setParent(entry.id)
      }}
    >
      <Button
        slot="drag"
        aria-label={`Drag ${label}`}
        appearance="plain"
        className={styles.dragHandle()}
      >
        <IcRoundDragIndicator />
      </Button>
      <Elevation className={styles.card()}>
        {icon && <Icon icon={icon} className={styles.icon()} />}
        <div className={styles.body()}>
          <div className={styles.label()}>{label}</div>
          <div className={styles.meta()}>{type.label}</div>
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
        <Elevation className={styles.dragPreview()}>
          <span className={styles.dragPreviewLabel()}>
            {items.length === 1 ? '1 item' : `${items.length} items`}
          </span>
        </Elevation>
      )
    }
  })
  return (
    <div className={styles.viewport()}>
      {isPending && (
        <div className={styles.pending()}>
          <ProgressCircle isIndeterminate aria-label="Pending..." />
        </div>
      )}
      {view === 'card' ? (
        <Virtualizer layout={GridLayout} layoutOptions={cardLayoutOptions}>
          <GridList
            aria-label="Explorer entries"
            items={items}
            layout="grid"
            className={styles.root({view: 'card'})}
            selectionMode="multiple"
            selectionBehavior="replace"
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
            className={styles.root({view: 'row'})}
            selectionMode="multiple"
            selectionBehavior="replace"
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
