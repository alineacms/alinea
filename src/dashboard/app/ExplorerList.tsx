import {Icon} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {
  isFileDropItem,
  useDragAndDrop
} from 'react-aria-components/useDragAndDrop'
import type {
  DashboardEntry,
  DashboardExplorer,
  DashboardRoot
} from '../store.js'
import {IcRoundSearch, LucideFile} from '../icons.js'
import {ExplorerCards} from './ExplorerCards.js'
import css from './ExplorerList.module.css'
import {ExplorerTable} from './ExplorerTable.js'

const styles = styler(css)
const fallbackEmptyIcon = atom(LucideFile)

interface EmptyResultsProps {
  root?: DashboardRoot
}

function EmptyResults({root}: EmptyResultsProps) {
  const icon = useAtomValue(root?.icon ?? fallbackEmptyIcon)
  return (
    <div className={styles.ExplorerList.empty()}>
      <Icon icon={icon} className={styles.ExplorerList.empty.icon()} />
      <div className={styles.ExplorerList.empty.copy()}>
        <div className={styles.ExplorerList.empty.title()}>
          No matching entries
        </div>
        <div className={styles.ExplorerList.empty.text()}>
          Try a different title, path, or field value.
        </div>
      </div>
    </div>
  )
}

function SearchIdleState() {
  return (
    <div className={styles.ExplorerList.empty()}>
      <Icon icon={IcRoundSearch} className={styles.ExplorerList.empty.icon()} />
      <div className={styles.ExplorerList.empty.copy()}>
        <div className={styles.ExplorerList.empty.title()}>Search entries</div>
        <div className={styles.ExplorerList.empty.text()}>
          Type to search all roots in this workspace.
        </div>
      </div>
    </div>
  )
}

export interface ExplorerListProps {
  explorer: DashboardExplorer
}

export function ExplorerList({explorer}: ExplorerListProps) {
  const items = useAtomValue(explorer.items)
  const view = useAtomValue(explorer.view)
  const showResults = useAtomValue(explorer.showResults)
  const root = useAtomValue(explorer.root)
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
  if (!showResults)
    return (
      <div className={styles.ExplorerList()}>
        <SearchIdleState />
      </div>
    )
  assert(
    root || explorer.rootScope === 'workspace',
    'ExplorerList requires a root'
  )
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
