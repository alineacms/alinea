import {Button, Icon} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom, type Atom} from 'jotai'
import {
  isFileDropItem,
  useDragAndDrop
} from 'react-aria-components/useDragAndDrop'
import type {
  DashboardEntry,
  DashboardExplorer,
  DashboardRoot
} from '../atoms/explorer.js'
import {IcRoundSearch, LucideFile} from '../icons.js'
import {ExplorerCards} from './ExplorerCards.js'
import css from './ExplorerList.module.css'
import {ExplorerTable} from './ExplorerTable.js'

const styles = styler(css)
const fallbackEmptyIcon = atom(LucideFile)

interface EmptyResultsProps {
  explorer: DashboardExplorer
  root?: DashboardRoot
}

function EmptyResults({explorer, root}: EmptyResultsProps) {
  const icon = useAtomValue(root?.icon ?? fallbackEmptyIcon)
  const searchScope = useAtomValue(explorer.searchScope)
  const setSearchScope = useSetAtom(explorer.searchScope)
  const canSearchEverything = useAtomValue(explorer.canSearchEverything)
  const canSearchAll = canSearchEverything && searchScope === 'workspace'
  return (
    <div className={styles.ExplorerList.empty()}>
      <Icon icon={icon} className={styles.ExplorerList.empty.icon()} />
      <div className={styles.ExplorerList.empty.copy()}>
        <div className={styles.ExplorerList.empty.title()}>
          No results found
        </div>
        <div className={styles.ExplorerList.empty.text()}>
          {canSearchAll
            ? 'Try different search terms or search all workspaces.'
            : 'Try different search terms.'}
        </div>
        {canSearchAll && (
          <Button
            appearance="plain"
            intent="primary"
            size="small"
            className={styles.ExplorerList.empty.button()}
            onPress={() => setSearchScope('everything')}
          >
            Try searching all workspaces
          </Button>
        )}
      </div>
    </div>
  )
}

function SearchIdleState() {
  return (
    <div className={styles.ExplorerList.empty()}>
      <Icon icon={IcRoundSearch} className={styles.ExplorerList.empty.icon()} />
      <div className={styles.ExplorerList.empty.copy()}>
        <div className={styles.ExplorerList.empty.title()}>Search</div>
        <div className={styles.ExplorerList.empty.text()}>
          Type to find any page in this workspace.
        </div>
      </div>
    </div>
  )
}

export interface ExplorerListProps {
  explorer: DashboardExplorer
  items?: Atom<Array<DashboardEntry>>
  locale: string | null
}

export function ExplorerList({
  explorer,
  items: readyItems,
  locale
}: ExplorerListProps) {
  const items = useAtomValue(readyItems ?? explorer.items(locale))
  const view = useAtomValue(explorer.view)
  const showResults = useAtomValue(explorer.showResults)
  const root = useAtomValue(explorer.root)
  const getItems = useSetAtom(explorer.getItems)
  const getDropOperation = useSetAtom(explorer.getDropOperation)
  const dropOnItem = useSetAtom(explorer.onItemDrop)
  const isMedia = useAtomValue(explorer.isMedia)
  const canUpload = useAtomValue(explorer.canUpload)
  const upload = useSetAtom(explorer.upload)
  const {dragAndDropHooks} = useDragAndDrop<DashboardEntry>({
    acceptedDragTypes: isMedia && canUpload ? 'all' : [],
    getItems,
    getDropOperation(target, types, allowedOperations) {
      const operation = getDropOperation(target, types, allowedOperations)
      if (operation !== 'cancel') return operation
      if (!isMedia || !canUpload || target.type !== 'root') return 'cancel'
      return allowedOperations.includes('copy') ? 'copy' : 'cancel'
    },
    onItemDrop(event) {
      dropOnItem(event, locale)
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
          locale={locale}
          renderEmptyState={() => (
            <EmptyResults explorer={explorer} root={root} />
          )}
        />
      ) : (
        <ExplorerTable
          dragAndDropHooks={dragAndDropHooks}
          explorer={explorer}
          items={items}
          locale={locale}
          renderEmptyState={() => (
            <EmptyResults explorer={explorer} root={root} />
          )}
        />
      )}
    </div>
  )
}
