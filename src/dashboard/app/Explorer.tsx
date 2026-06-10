import {Button, Popover, SearchField} from '#/components.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {slugify} from '#/core/util/Slugs.js'
import {ViewToggle} from '#/dashboard/app/ViewToggle.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import {DialogTrigger, FileTrigger, type Key} from 'react-aria-components'
import {
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundClose,
  IcRoundFilterList,
  IcRoundUploadFile
} from '../icons.js'
import type {DashboardEntry, DashboardEntryData} from '../store.js'
import {
  DashboardExplorer,
  ExplorerSort,
  ExplorerSortBy,
  ExplorerTypeFilters
} from '../store.js'
import {EditorBackButton} from './EditorBackButton.js'
import css from './Explorer.module.css'
import {ExplorerList} from './ExplorerList.js'
import {MutationQueueStatus} from './MutationQueueStatus.js'
import {RailBody, RailHeader} from './ui/Rail.js'

const styles = styler(css)

export interface ExplorerProps {
  controls?: ReactNode
  explorer: DashboardExplorer
  titleControls?: ReactNode
}

export interface ExplorerHeaderProps {
  autoFocusSearch?: boolean
  controls?: ReactNode
  explorer: DashboardExplorer
  titleControls?: ReactNode
}

export interface ExplorerBodyProps {
  explorer: DashboardExplorer
}

interface ExplorerSearchProps {
  autoFocus?: boolean
  explorer: DashboardExplorer
}

interface ExplorerHeaderMainProps {
  explorer: DashboardExplorer
  titleControls?: ReactNode
}

interface ExplorerHeaderLoadedParentMainProps {
  data: DashboardEntryData
  explorer: DashboardExplorer
  titleControls?: ReactNode
}

interface ExplorerHeaderParentMainProps {
  explorer: DashboardExplorer
  parent: DashboardEntry
  titleControls?: ReactNode
}

function ExplorerSearch({autoFocus, explorer}: ExplorerSearchProps) {
  const items = useAtomValue(
    useMemo(() => unwrap(explorer.items, previous => previous ?? []), [explorer])
  )
  const [selection, setSelection] = useAtom(explorer.selection)
  const search = useAtomValue(explorer.search)
  const setSearch = useSetAtom(explorer.search)
  const performAction = useSetAtom(explorer.onAction)
  const [inputValue, setInputValue] = useState(search)
  const [isPending, startTransition] = useTransition()

  function selectEntry(entry: DashboardEntry | undefined) {
    if (!entry) return
    setSelection(new Set<Key>([entry.id]))
  }

  function selectedEntry() {
    if (selection === 'all') return undefined
    const [selected] = selection
    if (selected === undefined) return undefined
    return items.find(item => item.id === String(selected))
  }

  useEffect(() => {
    if (!explorer.autoSelectFirstItem || !explorer.hasSelection) return
    if (items.length === 0) {
      if (selection !== 'all' && selection.size > 0)
        setSelection(new Set<Key>())
      return
    }
    if (!selectedEntry()) selectEntry(items[0])
  }, [explorer, items, selection, setSelection])

  function onSearchChange(value: string) {
    setInputValue(value)
    startTransition(() => {
      if (explorer.hasSelection) setSelection(new Set<Key>())
      setSearch(value)
    })
  }

  function selectedIndex() {
    const entry = selectedEntry()
    if (!entry) return -1
    return items.findIndex(item => item.id === entry.id)
  }

  function moveSelection(direction: 1 | -1) {
    if (!explorer.hasSelection || items.length === 0) return
    const current = selectedIndex()
    const next =
      current === -1
        ? direction === 1
          ? 0
          : items.length - 1
        : Math.max(0, Math.min(items.length - 1, current + direction))
    selectEntry(items[next])
  }

  function onSearchKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelection(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelection(-1)
    } else if (event.key === 'Enter') {
      const entry =
        selectedEntry() ??
        (explorer.autoSelectFirstItem ? items[0] : undefined)
      if (!entry) return
      event.preventDefault()
      performAction(entry)
    }
  }

  return (
    <SearchField
      aria-label="Search"
      autoFocus={autoFocus}
      className={styles.Explorer.search()}
      hasIcon
      isPending={isPending}
      placeholder="Search..."
      value={inputValue}
      onChange={onSearchChange}
      onKeyDown={onSearchKeyDown}
    />
  )
}

function ExplorerHeaderLoadedParentMain({
  data,
  explorer,
  titleControls
}: ExplorerHeaderLoadedParentMainProps) {
  const label = useAtomValue(data.label)
  const parents = useAtomValue(data.parents)
  const setLocation = useSetAtom(explorer.location)
  const parent = parents.at(-1)
  return (
    <div className={styles.ExplorerHeader.main()}>
      <EditorBackButton
        label={parent ? 'Back to parent entry' : 'Back to root'}
        onPress={() => {
          setLocation(location => ({
            ...location,
            parentId: parent?.id
          }))
        }}
      />
      <h1 className={styles.ExplorerHeader.title()}>{label}</h1>
      {titleControls}
    </div>
  )
}

function ExplorerHeaderMain({
  explorer,
  titleControls
}: ExplorerHeaderMainProps) {
  const root = useAtomValue(explorer.root)
  const parent = useAtomValue(explorer.parent)
  if (parent) {
    return (
      <ExplorerHeaderParentMain
        parent={parent}
        explorer={explorer}
        titleControls={titleControls}
      />
    )
  }
  if (root && titleControls) {
    return <div className={styles.ExplorerHeader.main()}>{titleControls}</div>
  }
  return null
}

function ExplorerHeaderParentMain({
  explorer,
  parent,
  titleControls
}: ExplorerHeaderParentMainProps) {
  const {data} = useAtomValue(parent.data)
  if (!data) return null
  return (
    <ExplorerHeaderLoadedParentMain
      data={data}
      explorer={explorer}
      titleControls={titleControls}
    />
  )
}

interface ExplorerToolbarProps {
  explorer: DashboardExplorer
}
const filters: Array<{type: ExplorerTypeFilters; label: string}> = [
  {type: MediaFile, label: 'File'},
  {type: MediaLibrary, label: 'Folder'}
]
const sortingOptions: Array<{id: ExplorerSortBy; label: string}> = [
  {id: 'index', label: 'Index'},
  {id: 'title', label: 'Title'},
  {id: 'id', label: 'Creation date'},
  {id: 'size', label: 'Size'}
]

interface ExplorerControlsProps {
  isMedia: boolean | undefined
  sort: ExplorerSort
  selectedFilter: ExplorerTypeFilters | undefined
  setSort: (sortBy: ExplorerSortBy) => void
  toggleFilter: (filterBy: ExplorerTypeFilters) => void
}

function ExplorerControlsButton({
  isMedia,
  sort,
  selectedFilter,
  setSort,
  toggleFilter
}: ExplorerControlsProps) {
  return (
    <DialogTrigger>
      <Button size="icon-nav" appearance="outline" icon={IcRoundFilterList} />
      <Popover placement="bottom left">
        <ExplorerControlsPopover
          isMedia={isMedia}
          sort={sort}
          selectedFilter={selectedFilter}
          setSort={setSort}
          toggleFilter={toggleFilter}
        />
      </Popover>
    </DialogTrigger>
  )
}
function ExplorerControlsPopover({
  isMedia,
  sort,
  selectedFilter,
  setSort,
  toggleFilter
}: ExplorerControlsProps) {
  return (
    <>
      {isMedia && (
        <>
          <span className={styles.Popover.Label()}>Filter by</span>
          {filters.map(filter => (
            <Button
              key={slugify(filter.label)}
              appearance={selectedFilter === filter.type ? 'active' : 'plain'}
              onPress={() => toggleFilter(filter.type)}
              className={styles.Sorting.button()}
            >
              {filter.label}
              {selectedFilter === filter.type && <IcRoundClose />}
            </Button>
          ))}
        </>
      )}
      <span className={styles.Popover.Label()}>Sort by</span>
      {sortingOptions.map(option =>
        !isMedia && option.id === 'size' ? null : (
          <Button
            key={option.id}
            appearance={sort.sortBy === option.id ? 'solid' : 'plain'}
            onPress={() => setSort(option.id)}
            className={styles.Sorting.button()}
          >
            {option.label}
            {sort.sortBy === option.id &&
              (sort.direction === 'asc' ? (
                <IcRoundArrowUpward />
              ) : (
                <IcRoundArrowDownward />
              ))}
          </Button>
        )
      )}
    </>
  )
}

function ExplorerToolbar({explorer}: ExplorerToolbarProps) {
  const [view, setView] = useAtom(explorer.view)
  const [sort, setSort] = useAtom(explorer.sort)
  const [selectedFilter, toggleFilter] = useAtom(explorer.filter)
  const isMedia = useAtomValue(explorer.isMedia)
  const canUpload = useAtomValue(explorer.canUpload)
  const uploads = useAtomValue(explorer.uploadsInCurrentFolder)
  const upload = useSetAtom(explorer.upload)
  const uploadLabel =
    uploads.length === 1
      ? '1 file uploading'
      : `${uploads.length} files uploading`

  return (
    <div className={styles.Explorer.toolbar.tools()}>
      {isMedia && uploads.length > 0 && (
        <MutationQueueStatus
          ariaLabel={uploadLabel}
          dashboard={explorer.dashboard}
          placement="bottom"
        >
          {uploads.length}
        </MutationQueueStatus>
      )}
      <ExplorerControlsButton
        isMedia={isMedia}
        sort={sort}
        selectedFilter={selectedFilter}
        setSort={setSort}
        toggleFilter={toggleFilter}
      />
      <div className={styles.Explorer.toolbar.mediaActions()}>
        <ViewToggle view={view} setView={setView} />
        {isMedia && canUpload && (
          <FileTrigger
            allowsMultiple
            onSelect={files => {
              if (files) upload(files)
            }}
          >
            <Button icon={IcRoundUploadFile} intent="primary">
              Upload media
            </Button>
          </FileTrigger>
        )}
      </div>
    </div>
  )
}

export function ExplorerHeader({
  autoFocusSearch,
  controls,
  explorer,
  titleControls
}: ExplorerHeaderProps) {
  return (
    <RailHeader className={styles.ExplorerHeader()}>
      <div className={styles.ExplorerHeader.content()}>
        <ExplorerHeaderMain explorer={explorer} titleControls={titleControls} />
        <div className={styles.Explorer.searchSlot()}>
          <ExplorerSearch autoFocus={autoFocusSearch} explorer={explorer} />
        </div>
        <div className={styles.Explorer.toolbar()}>
          <ExplorerToolbar explorer={explorer} />
          {controls}
        </div>
      </div>
    </RailHeader>
  )
}

export function ExplorerBody({explorer}: ExplorerBodyProps) {
  return (
    <RailBody>
      <div className={styles.Explorer.viewport()}>
        <ExplorerList explorer={explorer} />
      </div>
    </RailBody>
  )
}

export function Explorer({controls, explorer, titleControls}: ExplorerProps) {
  return (
    <>
      <ExplorerHeader
        controls={controls}
        explorer={explorer}
        titleControls={titleControls}
      />
      <ExplorerBody explorer={explorer} />
    </>
  )
}
