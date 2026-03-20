import {Checkbox, Elevation, Icon} from '@alinea/components'
import styler from '@alinea/styler'
import {Size} from '@react-stately/virtualizer'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {memo} from 'react'
import {
  GridLayout,
  type GridLayoutOptions,
  GridList,
  GridListItem,
  type Key,
  ListLayout,
  type ListLayoutOptions,
  type Selection,
  Virtualizer
} from 'react-aria-components'
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
  enableSelection: boolean
  explorer: DashboardExplorer
}

const ExplorerItem = memo(function ExplorerItem({
  entry,
  enableSelection,
  explorer
}: ExplorerItemProps) {
  const label = useAtomValue(entry.label)
  const icon = useAtomValue(entry.icon)
  const type = useAtomValue(entry.type)
  const hasChildren = useAtomValue(entry.hasChildren)
  const setParent = useSetAtom(explorer.parent)
  return (
    <GridListItem
      id={entry.id}
      textValue={label}
      className={styles.item()}
      onAction={() => {
        if (hasChildren) setParent(entry.id)
      }}
    >
      {enableSelection && (
        <Checkbox
          slot="selection"
          aria-label={`Select ${label}`}
          className={styles.checkbox()}
        />
      )}
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
  enableSelection?: boolean
}

export function ExplorerList({
  explorer,
  enableSelection = false
}: ExplorerListProps) {
  const view = useAtomValue(explorer.view)
  const [selectedKeys, setSelectedKeys] = useAtom(explorer.selection)
  const [isPending, items] = useAtomValue(explorer.items)
  function handleSelectionChange(next: Selection) {
    if (next === 'all') return
    setSelectedKeys(new Set<Key>(next))
  }
  return (
    <div className={styles.viewport()}>
      {view === 'card' ? (
        <Virtualizer layout={GridLayout} layoutOptions={cardLayoutOptions}>
          <GridList
            aria-label="Explorer entries"
            items={items}
            layout="grid"
            className={styles.root({view: 'card'})}
            selectionMode={enableSelection ? 'multiple' : 'none'}
            selectionBehavior="toggle"
            selectedKeys={selectedKeys}
            onSelectionChange={handleSelectionChange}
            style={{display: 'block', height: '100%'}}
            renderEmptyState={() => {
              return <div>{isPending ? 'loading' : null}</div>
            }}
          >
            {item => (
              <ExplorerItem
                entry={item}
                enableSelection={enableSelection}
                explorer={explorer}
              />
            )}
          </GridList>
        </Virtualizer>
      ) : (
        <Virtualizer layout={ListLayout} layoutOptions={rowLayoutOptions}>
          <GridList
            aria-label="Explorer entries"
            items={items}
            layout="stack"
            className={styles.root({view: 'row'})}
            selectionMode={enableSelection ? 'multiple' : 'none'}
            selectionBehavior="toggle"
            selectedKeys={selectedKeys}
            onSelectionChange={handleSelectionChange}
            style={{display: 'block', height: '100%'}}
          >
            {item => (
              <ExplorerItem
                entry={item}
                enableSelection={enableSelection}
                explorer={explorer}
              />
            )}
          </GridList>
        </Virtualizer>
      )}
    </div>
  )
}
