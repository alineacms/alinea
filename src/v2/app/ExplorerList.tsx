import {Checkbox} from '@alinea/components'
import styler from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {GridList, GridListItem} from 'react-aria-components'
import type {DashboardEntry, DashboardExplorer} from '../store.js'
import css from './ExplorerList.module.css'

const styles = styler(css)

interface ExplorerItemProps {
  entry: DashboardEntry
  explorer: DashboardExplorer
}

function ExplorerItem({entry, explorer}: ExplorerItemProps) {
  const label = useAtomValue(entry.label)
  return (
    <GridListItem
      id={entry.id}
      textValue={label}
      // open entry
      //onAction={selection ? undefined : () => void openEntry(item.entry.id)}
      className={styles.item()}
    >
      <Checkbox
        slot="selection"
        aria-label={`Select ${label}`}
        className={styles.item.checkbox()}
      />
      <div className={styles.item.content()}>Entry {label}</div>
    </GridListItem>
  )
}

export interface ExplorerListProps {
  explorer: DashboardExplorer
  enableSelection?: boolean
}

export function ExplorerList({
  explorer,
  enableSelection = false
}: ExplorerListProps) {
  const [view, setView] = useAtom(explorer.view)
  const [selectedKeys, setSelectedKeys] = useAtom(explorer.selection)
  const [isPending, items] = useAtomValue(explorer.items)
  return (
    <GridList
      aria-label="Explorer entries"
      items={items}
      layout={view === 'card' ? 'grid' : 'stack'}
      className={styles.root({view})}
      selectionMode={enableSelection ? 'multiple' : 'none'}
      selectionBehavior="toggle"
      selectedKeys={selectedKeys}
      onSelectionChange={setSelectedKeys}
    >
      {item => <ExplorerItem entry={item} explorer={explorer} />}
    </GridList>
  )
}
