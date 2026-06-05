import {Icon} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {
  isFileDropItem,
  useDragAndDrop
} from 'react-aria-components/useDragAndDrop'
import type {
  DashboardEntry,
  DashboardExplorer,
  DashboardRoot
} from '../store.js'
import {ExplorerCards} from './ExplorerCards.js'
import css from './ExplorerList.module.css'
import {ExplorerTable} from './ExplorerTable.js'

const styles = styler(css)

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
  const items = useAtomValue(explorer.items)
  const view = useAtomValue(explorer.view)
  const root = useAtomValue(explorer.root)
  assert(root, 'ExplorerList requires a root')
  const getItems = useSetAtom(explorer.getItems)
  const isMedia = useAtomValue(explorer.isMedia)
  const canUpload = useAtomValue(explorer.canUpload)
  const upload = useSetAtom(explorer.upload)
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
  return (
    <div className={styles.ExplorerList()}>
      {view === 'card' ? (
        <ExplorerCards
          dragAndDropHooks={dragAndDropHooks}
          explorer={explorer}
          items={items}
          renderEmptyState={() => <EmptyResults root={root} />}
        />
      ) : (
        <ExplorerTable
          dragAndDropHooks={dragAndDropHooks}
          explorer={explorer}
          items={items}
          renderEmptyState={() => <EmptyResults root={root} />}
        />
      )}
    </div>
  )
}
