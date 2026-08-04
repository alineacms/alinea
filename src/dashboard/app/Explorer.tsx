import {Button, Menu, MenuItem, Popover, SearchField} from '#/components.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {slugify} from '#/core/util/Slugs.js'
import {ViewToggle} from '#/dashboard/app/ViewToggle.js'
import styler from '@alinea/styler'
import {atom, useSetAtom} from 'jotai'
import {
  useEffect,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import {DialogTrigger, FileTrigger, type Key} from 'react-aria-components'
import {useAtom, useAtomValue} from '../AtomHooks.js'
import type {EntryAtoms, EntryDataAtoms} from '../atoms/entry.js'
import type {
  ExplorerAtoms,
  ExplorerSort,
  ExplorerSortBy,
  ExplorerTypeFilters
} from '../atoms/explorer.js'
import {AtomSnapshot} from '../AtomSnapshot.js'
import {
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundClose,
  IcRoundFilterList,
  IcRoundUnfoldMore,
  IcRoundUploadFile,
  IcRoundPublic
} from '../icons.js'
import {EditorBackButton} from './EditorBackButton.js'
import css from './Explorer.module.css'
import {ExplorerList} from './ExplorerList.js'
import {MutationQueueStatus} from './MutationQueueStatus.js'
import {RailBody, RailHeader} from './ui/Rail.js'
import {workspaceAtoms, workspacesAtom} from '../atoms/config.js'
import {WorkspaceItem} from './WorkspaceMenu.js'
import {LocaleMenu} from './LocaleMenu.js'

const styles = styler(css)

export interface ExplorerProps {
  controls?: ReactNode
  explorer: ExplorerAtoms
  items: Array<EntryAtoms>
  navigate?: boolean
  titleControls?: ReactNode
}

export interface ExplorerHeaderProps {
  autoFocusSearch?: boolean
  controls?: ReactNode
  explorer: ExplorerAtoms
  items: Array<EntryAtoms>
  navigate?: boolean
  titleControls?: ReactNode
}

export interface ExplorerBodyProps {
  explorer: ExplorerAtoms
  items: Array<EntryAtoms>
}

interface ExplorerSearchProps {
  autoFocus?: boolean
  explorer: ExplorerAtoms
  items: Array<EntryAtoms>
}

interface ExplorerHeaderMainProps {
  explorer: ExplorerAtoms
  titleControls?: ReactNode
}

interface ExplorerHeaderLoadedParentMainProps {
  data: EntryDataAtoms
  explorer: ExplorerAtoms
  titleControls?: ReactNode
}

interface ExplorerHeaderParentMainProps {
  explorer: ExplorerAtoms
  parent: EntryAtoms
  titleControls?: ReactNode
}

function ExplorerSearch({
  autoFocus = true,
  explorer,
  items
}: ExplorerSearchProps) {
  const [selection, setSelection] = useAtom(explorer.selection)
  const search = useAtomValue(explorer.search)
  const setSearch = useSetAtom(explorer.search)
  const performAction = useSetAtom(explorer.onAction)
  const [inputValue, setInputValue] = useState(search)
  const [isPending, startTransition] = useTransition()

  function selectEntry(entry: EntryAtoms | undefined) {
    if (!entry) return
    setSelection(new Set<Key>([entry.id]))
  }

  const selectedKey =
    selection === 'all' ? undefined : selection.values().next().value
  const selectedEntry =
    selectedKey === undefined
      ? undefined
      : items.find(item => item.id === String(selectedKey))
  const {autoSelectFirstItem, hasSelection} = explorer

  // Keep keyboard navigation selection synchronized with the current filtered
  // item list so Enter can act on the first result when configured.
  // eslint-disable react-you-might-not-need-an-effect/no-event-handler
  useEffect(() => {
    if (!autoSelectFirstItem || !hasSelection) return
    if (items.length === 0) {
      if (selection !== 'all' && selection.size > 0)
        setSelection(new Set<Key>())
      return
    }
    if (!selectedEntry) setSelection(new Set<Key>([items[0].id]))
  }, [
    autoSelectFirstItem,
    hasSelection,
    items,
    selectedEntry,
    selection,
    setSelection
  ])
  // eslint-enable react-you-might-not-need-an-effect/no-event-handler

  function onSearchChange(value: string) {
    setInputValue(value)
    startTransition(() => {
      // if (explorer.hasSelection) setSelection(new Set<Key>())
      setSearch(value)
    })
  }

  function selectedIndex() {
    if (!selectedEntry) return -1
    return items.findIndex(item => item.id === selectedEntry.id)
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
        selectedEntry ?? (autoSelectFirstItem ? items[0] : undefined)
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

function WorkspaceMenu({explorer}: {explorer: ExplorerAtoms}) {
  const [currentWorkspace, setWorkspace] = useAtom(explorer.workspace)
  const workspaces = useAtomValue(workspacesAtom)

  return (
    <Menu
      label={currentWorkspace.key}
      onAction={key => {
        setWorkspace(String(key))
      }}
      appearance="plain"
      icon={IcRoundUnfoldMore}
    >
      {workspaces.map(workspace => (
        <WorkspaceItem key={workspace} workspace={workspaceAtoms(workspace)} />
      ))}
    </Menu>
  )
}

function RootMenu({explorer}: {explorer: ExplorerAtoms}) {
  const [currentRoot, setRoot] = useAtom(explorer.root)
  const workspace = useAtomValue(explorer.workspace)
  const roots = useAtomValue(workspace.rootMenu)
  const settings = useAtomValue(
    currentRoot?.settings ?? atom({label: 'Missing root label'})
  )
  const label = settings.label

  return (
    <Menu
      label={label}
      onAction={key => {
        setRoot(String(key))
      }}
      appearance="plain"
      icon={IcRoundUnfoldMore}
    >
      {roots.map(root => (
        <MenuItem key={root.id} id={root.id} textValue={root.label}>
          {root.label}
        </MenuItem>
      ))}
    </Menu>
  )
}

export interface ExplorerSnapshotProps {
  children(items: Array<EntryAtoms>): ReactNode
  explorer: ExplorerAtoms
}

export function ExplorerSnapshot({children, explorer}: ExplorerSnapshotProps) {
  return (
    <AtomSnapshot atom={explorer.snapshot}>
      {snapshot => children(snapshot.items)}
    </AtomSnapshot>
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
  explorer: ExplorerAtoms
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
          <p className={styles.Popover.Label()}>Filter by</p>
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
      <p className={styles.Popover.Label()}>Sort by</p>
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
  const [global, setGlobal] = useAtom(explorer.global)
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
        <MutationQueueStatus ariaLabel={uploadLabel} placement="bottom">
          {uploads.length}
        </MutationQueueStatus>
      )}
      <Button
        appearance={global ? 'active' : 'outline'}
        icon={IcRoundPublic}
        onPress={() => setGlobal(!global)}
      />
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
  items,
  navigate,
  titleControls
}: ExplorerHeaderProps) {
  const root = useAtomValue(explorer.root)
  const global = useAtomValue(explorer.global)
  return (
    <RailHeader className={styles.ExplorerHeader()}>
      <div className={styles.ExplorerHeader.content()}>
        <ExplorerHeaderMain explorer={explorer} titleControls={titleControls} />
        {navigate && !global && (
          <div className={styles.Explorer.searchMenu()}>
            <WorkspaceMenu explorer={explorer} />
            <RootMenu explorer={explorer} />
            {root && (
              <LocaleMenu
                root={root}
                selectedLocale={explorer.selectedLocale}
              />
            )}
          </div>
        )}
        <div className={styles.Explorer.searchSlot()}>
          <ExplorerSearch
            autoFocus={autoFocusSearch}
            explorer={explorer}
            items={items}
          />
        </div>
        <div className={styles.Explorer.toolbar()}>
          <ExplorerToolbar explorer={explorer} />
          {controls}
        </div>
      </div>
    </RailHeader>
  )
}

export function ExplorerBody({explorer, items}: ExplorerBodyProps) {
  return (
    <RailBody>
      <div className={styles.Explorer.viewport()}>
        <ExplorerList explorer={explorer} items={items} />
      </div>
    </RailBody>
  )
}

export function Explorer({
  controls,
  explorer,
  items,
  navigate,
  titleControls
}: ExplorerProps) {
  return (
    <>
      <ExplorerHeader
        controls={controls}
        explorer={explorer}
        items={items}
        navigate={navigate}
        titleControls={titleControls}
      />
      <ExplorerBody explorer={explorer} items={items} />
    </>
  )
}
