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
import {atom, useAtomValueRaw, useSetAtom, useStore} from 'jotai'
import {useLayoutEffect, useRef} from 'react'
import {
  explorerPageIsPending,
  explorerScrollKey,
  type DashboardExplorer,
  type DashboardRoot,
  type ExplorerReadyPage
} from '../atoms/explorer.js'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDropIds
} from '../atoms/utils.js'
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

/** Frames to wait for virtualized results to size before giving up */
const scrollRestoreFrames = 30
/** Frames the restored offset has to hold before scrolling is recorded again */
const scrollSettleFrames = 3

/**
 * Keeps the scroll offset of the results of a page and restores it when a
 * page with the same results is shown again, eg. after returning from an
 * entry opened from the list
 */
function useScrollRestoration(
  explorer: DashboardExplorer,
  page: ExplorerReadyPage
) {
  const store = useStore()
  const container = useRef<HTMLDivElement>(null)
  const scrollOffset = explorer.scrollOffset(explorerScrollKey(page))
  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const scroller = element.querySelector<HTMLElement>(
      '[role="grid"], [role="treegrid"]'
    )
    const target = store.get(scrollOffset)
    let restoring = scroller !== null
    let frame = 0
    let frames = 0
    let settled = 0
    // Virtualized results size their contents after rendering and apply the
    // offset they last knew once they did, keep scrolling until it holds
    function restore() {
      if (!scroller || !restoring) return
      scroller.scrollTop = target
      settled = Math.abs(scroller.scrollTop - target) < 1 ? settled + 1 : 0
      if (settled >= scrollSettleFrames || ++frames > scrollRestoreFrames) {
        restoring = false
        return
      }
      frame = requestAnimationFrame(restore)
    }
    function stopRestoring() {
      restoring = false
      cancelAnimationFrame(frame)
    }
    // Scroll events do not bubble, listen while capturing so the results
    // can be rendered again without losing the listener
    function onScroll(event: Event) {
      if (restoring) return
      const scrolled = event.target
      if (!(scrolled instanceof HTMLElement)) return
      const role = scrolled.getAttribute('role')
      if (role !== 'grid' && role !== 'treegrid') return
      store.set(scrollOffset, scrolled.scrollTop)
    }
    element.addEventListener('scroll', onScroll, {capture: true, passive: true})
    element.addEventListener('wheel', stopRestoring, {passive: true})
    element.addEventListener('touchstart', stopRestoring, {passive: true})
    element.addEventListener('pointerdown', stopRestoring)
    element.addEventListener('keydown', stopRestoring)
    restore()
    return () => {
      stopRestoring()
      element.removeEventListener('scroll', onScroll, {capture: true})
      element.removeEventListener('wheel', stopRestoring)
      element.removeEventListener('touchstart', stopRestoring)
      element.removeEventListener('pointerdown', stopRestoring)
      element.removeEventListener('keydown', stopRestoring)
    }
  }, [scrollOffset, store])
  return container
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
  const container = useScrollRestoration(explorer, page)
  const getDragData = useSetAtom(explorer.getDragData)
  const canDrop = useSetAtom(explorer.canDrop)
  const moveInto = useSetAtom(explorer.moveInto)
  const reorder = useSetAtom(explorer.reorder)
  const requestedLocation = useAtomValueRaw(explorer.location)
  const selectedLocale = useAtomValueRaw(explorer.selectedLocale)
  const locationIsPending = explorerPageIsPending(
    page,
    requestedLocation,
    selectedLocale
  )
  const upload = useSetAtom(explorer.upload)
  const acceptsDrops = page.isMedia && page.canUpload && !locationIsPending
  // Entries in their stored order can be reordered, sorting only changes
  // the view
  const canReorder =
    explorer.hasRowAction &&
    page.sort.manual &&
    page.resultMode === 'browse' &&
    !locationIsPending
  const dragDrop: DragDropProps = {
    getDragData,
    acceptedDragTypes: acceptsDrops ? undefined : [],
    canDrop(target, types) {
      if (target.position === 'on') return canDrop(target, types)
      return canReorder && acceptsDashboardEntryDrag(types)
    },
    onReorder: canReorder
      ? event => reorder([...event.keys].map(String), event.target, page.locale)
      : undefined,
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
    <div
      ref={container}
      className={styles.ExplorerList()}
      data-reorderable={canReorder || undefined}
    >
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
