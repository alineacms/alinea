import {Elevation, Icon} from '@alinea/components'
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
  explorer: DashboardExplorer
}

const ExplorerItem = memo(function ExplorerItem({
  entry,
  explorer
}: ExplorerItemProps) {
  const label = useAtomValue(entry.label)
  const icon = useAtomValue(entry.icon)
  const type = useAtomValue(entry.type)
  const setSelectedKeys = useSetAtom(explorer.selection)
  const setParent = useSetAtom(explorer.parent)
  return (
    <GridListItem
      id={entry.id}
      textValue={label}
      className={styles.item()}
      onAction={() => {
        setSelectedKeys(current => {
          const next = new Set<Key>(current === 'all' ? [] : current)
          if (next.has(entry.id)) next.delete(entry.id)
          else next.add(entry.id)
          return next
        })
        if (entry.hasChildren) setParent(entry.id)
      }}
    >
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
            selectionMode="multiple"
            selectionBehavior="toggle"
            selectedKeys={selectedKeys}
            onSelectionChange={handleSelectionChange}
            style={{display: 'block', height: '100%'}}
            renderEmptyState={() => {
              return <div>{isPending ? 'loading' : null}</div>
            }}
          >
            {item => (
              <ExplorerItem entry={item} explorer={explorer} />
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
            selectionMode="multiple"
            selectionBehavior="toggle"
            selectedKeys={selectedKeys}
            onSelectionChange={handleSelectionChange}
            style={{display: 'block', height: '100%'}}
          >
            {item => (
              <ExplorerItem entry={item} explorer={explorer} />
            )}
          </GridList>
        </Virtualizer>
      )}
    </div>
  )
}
