import {
  Button,
  type DragDropProps,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  type Selection
} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw, useSetAtom} from 'jotai'
import {
  explorerPageIsPending,
  type DashboardExplorer,
  type DashboardRoot,
  type ExplorerReadyPage
} from '../atoms/explorer.js'
import {dashboardEntryDropIds} from '../atoms/utils.js'
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
  const icon = useAtomValueRaw(root?.icon ?? fallbackEmptyIcon)
  const setSearchScope = useSetAtom(explorer.searchScope)
  const canSearchEverything = useAtomValueRaw(explorer.canSearchEverything)
  const canSearchAll =
    canSearchEverything &&
    page.searchScope === 'workspace' &&
    (explorer.mode === 'search' || page.resultMode === 'matches')
  return (
    <Empty className={styles.ExplorerList.empty()}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon icon={icon} />
        </EmptyMedia>
        <EmptyTitle>No results found</EmptyTitle>
        <EmptyDescription>
          {canSearchAll
            ? 'Try different search terms or search all workspaces.'
            : 'Try different search terms.'}
        </EmptyDescription>
      </EmptyHeader>
      {canSearchAll && (
        <EmptyContent>
          <Button
            variant="ghost"
            color="primary"
            size="sm"
            className={styles.ExplorerList.empty.button()}
            onClick={() => setSearchScope('everything')}
          >
            Try searching all workspaces
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}

function SearchIdleState() {
  return (
    <Empty className={styles.ExplorerList.empty()}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon icon={IcRoundSearch} />
        </EmptyMedia>
        <EmptyTitle>Search</EmptyTitle>
        <EmptyDescription>Type to find a page.</EmptyDescription>
      </EmptyHeader>
    </Empty>
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
  const showResults = explorer.mode !== 'search' || Boolean(page.search.trim())
  const getDragData = useSetAtom(explorer.getDragData)
  const canDrop = useSetAtom(explorer.canDrop)
  const moveInto = useSetAtom(explorer.moveInto)
  const requestedLocation = useAtomValueRaw(explorer.location)
  const selectedLocale = useAtomValueRaw(explorer.selectedLocale)
  const locationIsPending = explorerPageIsPending(
    page,
    requestedLocation,
    selectedLocale
  )
  const upload = useSetAtom(explorer.upload)
  const acceptsDrops = page.isMedia && page.canUpload && !locationIsPending
  const dragDrop: DragDropProps = {
    getDragData,
    acceptedDragTypes: acceptsDrops ? undefined : [],
    canDrop,
    onMove(event) {
      return moveInto([...event.keys].map(String), event.target, page.locale)
    },
    onDropItems(event) {
      return moveInto(
        dashboardEntryDropIds(event.items),
        event.target,
        page.locale
      )
    },
    onDropFiles: acceptsDrops
      ? async event => {
          // Files can only be dropped on the list itself, not on an entry
          if (event.target || locationIsPending) return
          await upload(event.files)
        }
      : undefined,
    renderDragPreview(items) {
      return (
        <div className={styles.ExplorerList.drag.preview()}>
          <span className={styles.ExplorerList.drag.preview.label()}>
            {items.length === 1 ? '1 item' : `${items.length} items`}
          </span>
        </div>
      )
    }
  }
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
          dragDrop={dragDrop}
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
          dragDrop={dragDrop}
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
