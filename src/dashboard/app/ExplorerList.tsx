import {
  Button,
  type DragDropProps,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon
} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw, useSetAtom, useStore} from 'jotai'
import {type RefObject, useLayoutEffect, useRef} from 'react'
import {
  explorerPageIsPending,
  explorerScrollKey,
  type DashboardEntry,
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
    page.scope !== 'everything' &&
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
    // A page that shows a selected match scrolls to it instead
    let restoring =
      scroller !== null && store.get(explorer.revealKey) === undefined
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
  }, [explorer.revealKey, scrollOffset, store])
  return container
}

/**
 * Scrolls the match an editor selected into view once the folder that holds
 * it is shown, after browsing from the matches
 */
/** The element that scrolls the results: the grid or one of its parents */
function scrollingElement(element: HTMLElement): HTMLElement | undefined {
  let current: HTMLElement | null = element
  while (current) {
    if (current.scrollHeight > current.clientHeight) {
      const {overflowY} = getComputedStyle(current)
      if (overflowY === 'auto' || overflowY === 'scroll') return current
    }
    current = current.parentElement
  }
  return undefined
}

/**
 * Whether a row is rendered near the visible part of the results: rows kept
 * rendered for focus may sit far outside of it
 */
function isNear(row: HTMLElement, scroller: HTMLElement) {
  const box = row.getBoundingClientRect()
  const view = scroller.getBoundingClientRect()
  return (
    box.bottom > view.top - view.height && box.top < view.bottom + view.height
  )
}

function useRevealSelected(
  explorer: DashboardExplorer,
  page: ExplorerReadyPage,
  container: RefObject<HTMLDivElement | null>
) {
  const store = useStore()
  useLayoutEffect(() => {
    const key = store.get(explorer.revealKey)
    if (key === undefined || page.resultMode !== 'browse') return
    const index = page.items.findIndex(item => item.id === key)
    store.set(explorer.revealKey, undefined)
    if (index === -1) return
    const id = key
    let frame = 0
    let frames = 0
    // Virtualized results size their contents after rendering, so the
    // element that scrolls them is looked up again each frame
    function reveal() {
      const results = container.current?.querySelector<HTMLElement>(
        '[role="grid"], [role="treegrid"]'
      )
      const scroller = results && scrollingElement(results)
      if (results && scroller) {
        const row = results.querySelector<HTMLElement>(
          `[data-key="${CSS.escape(id)}"]`
        )
        if (row && isNear(row, scroller))
          return row.scrollIntoView({block: 'nearest'})
        // Scroll to the estimated position so the row gets rendered
        scroller.scrollTop =
          (index / page.items.length) * scroller.scrollHeight -
          scroller.clientHeight / 2
      }
      if (++frames <= scrollRestoreFrames) frame = requestAnimationFrame(reveal)
    }
    reveal()
    return () => cancelAnimationFrame(frame)
  }, [container, explorer.revealKey, page, store])
}

export interface ExplorerListProps {
  compactTable?: boolean
  explorer: DashboardExplorer
  /**
   * Called when a selectable entry is clicked, pickers that select a single
   * entry confirm it right away
   */
  onPick?: (entry: DashboardEntry) => void
  page: ExplorerReadyPage
}

export function ExplorerList({
  compactTable,
  explorer,
  onPick,
  page
}: ExplorerListProps) {
  const showResults = explorer.mode !== 'search' || Boolean(page.search.trim())
  const container = useScrollRestoration(explorer, page)
  useRevealSelected(explorer, page, container)
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
  const acceptsDrops =
    page.uploadTypes.length > 0 && page.canUpload && !locationIsPending
  // Explorers of the dashboard move entries, pickers do not
  const canMove = explorer.hasRowAction && !locationIsPending
  // Entries in their stored order can be reordered, sorting only changes
  // the view
  const canReorder = canMove && page.sort.manual && page.resultMode === 'browse'
  const dragDrop: DragDropProps = {
    getDragData,
    canDrop(target, types) {
      if (target.position === 'on')
        return canMove && canDrop(target, types, page.locale)
      return canReorder && acceptsDashboardEntryDrag(types)
    },
    onReorder: canReorder
      ? event => reorder([...event.keys].map(String), event.target, page.locale)
      : undefined,
    onMove: canMove
      ? event => moveInto([...event.keys].map(String), event.target)
      : undefined,
    onDropItems: canMove
      ? event => {
          const ids = dashboardEntryDropIds(event.items)
          if (event.target.position === 'on') return moveInto(ids, event.target)
          return reorder(ids, event.target, page.locale)
        }
      : undefined,
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
          onPick={onPick}
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
          onPick={onPick}
          page={page}
          renderEmptyState={() => (
            <EmptyResults explorer={explorer} page={page} root={page.root} />
          )}
        />
      )}
    </div>
  )
}
