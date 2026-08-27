import {Button, Icon} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {
  isFileDropItem,
  useDragAndDrop
} from 'react-aria-components/useDragAndDrop'
import type {Selection} from 'react-aria-components'
import {
  explorerPageIsPending,
  type DashboardEntry,
  type DashboardExplorer,
  type DashboardRoot,
  type ExplorerReadyPage
} from '../atoms/explorer.js'
import {IcRoundSearch, LucideFile} from '../icons.js'
import {ExplorerCards} from './ExplorerCards.js'
import css from './ExplorerList.module.css'
import {ExplorerTable} from './ExplorerTable.js'

const styles = styler(css)
const fallbackEmptyIcon = atom(LucideFile)

interface EmptyResultsProps {
  explorer: DashboardExplorer
  page: ExplorerReadyPage
  root?: DashboardRoot
}

function EmptyResults({explorer, page, root}: EmptyResultsProps) {
  const icon = useAtomValue(root?.icon ?? fallbackEmptyIcon)
  const setSearchScope = useSetAtom(explorer.searchScope)
  const canSearchEverything = useAtomValue(explorer.canSearchEverything)
  const canSearchAll =
    canSearchEverything &&
    page.searchScope === 'workspace' &&
    (explorer.mode === 'search' || page.resultMode === 'matches')
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
          Type to find a page.
        </div>
      </div>
    </div>
  )
}

export interface ExplorerListProps {
  compactTable?: boolean
  explorer: DashboardExplorer
  onSelectionChange?: (selection: Selection) => void
  page: ExplorerReadyPage
}

export function ExplorerList({
  compactTable,
  explorer,
  onSelectionChange,
  page
}: ExplorerListProps) {
  const showResults = useAtomValue(explorer.showResults)
  const getItems = useSetAtom(explorer.getItems)
  const getDropOperation = useSetAtom(explorer.getDropOperation)
  const dropOnItem = useSetAtom(explorer.onItemDrop)
  const requestedLocation = useAtomValue(explorer.location)
  const selectedLocale = useAtomValue(explorer.selectedLocale)
  const locationIsPending = explorerPageIsPending(
    page,
    requestedLocation,
    selectedLocale
  )
  const canUpload = useAtomValue(explorer.canUpload)
  const upload = useSetAtom(explorer.upload)
  const {dragAndDropHooks} = useDragAndDrop<DashboardEntry>({
    acceptedDragTypes:
      page.isMedia && canUpload && !locationIsPending ? 'all' : [],
    getItems,
    getDropOperation(target, types, allowedOperations) {
      const operation = getDropOperation(target, types, allowedOperations)
      if (operation !== 'cancel') return operation
      if (
        !page.isMedia ||
        !canUpload ||
        locationIsPending ||
        target.type !== 'root'
      )
        return 'cancel'
      return allowedOperations.includes('copy') ? 'copy' : 'cancel'
    },
    onItemDrop(event) {
      dropOnItem(event, page.locale)
    },
    async onRootDrop(event) {
      if (locationIsPending) return
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
    page.root || explorer.rootScope === 'workspace',
    'ExplorerList requires a root'
  )
  return (
    <div className={styles.ExplorerList()}>
      {page.view === 'card' ? (
        <ExplorerCards
          dragAndDropHooks={dragAndDropHooks}
          explorer={explorer}
          items={page.items}
          locale={page.locale}
          page={page}
          renderEmptyState={() => (
            <EmptyResults explorer={explorer} page={page} root={page.root} />
          )}
        />
      ) : (
        <ExplorerTable
          compact={compactTable}
          dragAndDropHooks={dragAndDropHooks}
          explorer={explorer}
          items={page.items}
          locale={page.locale}
          onSelectionChange={onSelectionChange}
          page={page}
          renderEmptyState={() => (
            <EmptyResults explorer={explorer} page={page} root={page.root} />
          )}
        />
      )}
    </div>
  )
}
