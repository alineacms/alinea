import {PageContent} from '#/components.js'
import {MediaLibrary} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {
  type DashboardExplorer,
  type ExplorerReadyPage,
  explorerScrollKey
} from '#/dashboard/atoms/explorer.js'
import type {RootAtoms} from '#/dashboard/atoms/root.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useAtomValueRawSync} from 'jotai'
import {useEffect, useRef, useState, type ReactNode} from 'react'
import {CreateEntryButton} from './DashboardLayout.js'
import {
  ExplorerBatchActions,
  ExplorerItemActions
} from './ExplorerBatchActions.js'
import {ExplorerList} from './ExplorerList.js'
import css from './Overview.module.css'
import {OverviewHeader} from './OverviewHeader.js'
import {OverviewToolbar} from './OverviewToolbar.js'
import {OverviewUpload} from './OverviewUpload.js'

const styles = styler(css)

export interface OverviewProps {
  explorer: DashboardExplorer
  page: ExplorerReadyPage
  readOnly?: boolean
  root: RootAtoms
  /** Title of the overview's entry, for entries outside the tree */
  title?: string
  /** Shown first in the header, eg. to switch to editing the entry */
  toggle?: ReactNode
}

/** The entries of a root or parent entry as a table or cards */
export function Overview({
  explorer,
  page: loadedPage,
  readOnly,
  root,
  title,
  toggle
}: OverviewProps) {
  const resolvedPage = useAtomValueRawSync(explorer.page)
  // The overview shows its own updates, such as a new search, but keeps the
  // locale of the page until the page of another locale replaces it
  const page =
    resolvedPage?.locale === loadedPage.locale ? resolvedPage : loadedPage
  const rootLabel = useAtomValueRaw(page.root.label)
  const [list, scrolled] = useScrolled(explorerScrollKey(page))
  const config = useAtomValueRaw(configAtom)
  // Files are uploaded, so in a media folder only folders are created
  const creatable = page.overview.types.filter(name => {
    const type = config.schema[name]
    return type && !Type.isHidden(type)
  })
  const createsFolders =
    page.isMedia ||
    (creatable.length > 0 &&
      creatable.every(name => config.schema[name] === MediaLibrary))
  return (
    <ExplorerItemActions explorer={explorer}>
      <OverviewHeader
        actions={
          <>
            <CreateEntryButton
              root={root}
              toolbar
              secondary={page.isMedia && page.canUpload}
              label={createsFolders ? 'Create folder' : undefined}
            />
            <OverviewUpload explorer={explorer} page={page} />
          </>
        }
        explorer={explorer}
        page={page}
        readOnly={readOnly ?? (page.isMedia && !page.canUpload)}
        title={title}
        toggle={toggle}
      />
      <PageContent className={styles.Overview()}>
        <OverviewToolbar
          explorer={explorer}
          label={page.parent?.title ?? rootLabel}
          page={page}
          scrolled={scrolled && page.view === 'card'}
        />
        <div
          ref={list}
          className={styles.Overview.list({cards: page.view === 'card'})}
        >
          <ExplorerList explorer={explorer} overview page={page} />
        </div>
        {explorer.hasRowAction && explorer.selectionMode === 'multiple' && (
          <ExplorerBatchActions explorer={explorer} />
        )}
      </PageContent>
    </ExplorerItemActions>
  )
}

/**
 * Whether a list inside the element has scrolled down. Each list, by its
 * scroll key, starts at the top unless it scrolls when its offset is restored.
 */
function useScrolled(key: string) {
  const ref = useRef<HTMLDivElement>(null)
  const keyRef = useRef(key)
  const [scrolled, setScrolled] = useState<string>()
  useEffect(() => {
    keyRef.current = key
  }, [key])
  useEffect(() => {
    const element = ref.current
    if (!element) return
    // Scroll events do not bubble, capture those of the list's scroller
    function onScroll(event: Event) {
      if (event.target instanceof Element)
        setScrolled(event.target.scrollTop > 0 ? keyRef.current : undefined)
    }
    element.addEventListener('scroll', onScroll, {capture: true, passive: true})
    return () => element.removeEventListener('scroll', onScroll, true)
  }, [])
  return [ref, scrolled === key] as const
}
