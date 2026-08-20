import {
  Button,
  Menu,
  MenuItem,
  Popover,
  SearchField,
  Switch,
  ToggleButton,
  ToggleButtonGroup
} from '#/components.js'
import {getRoot, getWorkspace} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {slugify} from '#/core/util/Slugs.js'
import {ViewToggle} from '#/dashboard/app/ViewToggle.js'
import {rootAtoms} from '#/dashboard/atoms/root.js'
import {policyAtom} from '#/dashboard/atoms/user.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import {
  DialogTrigger,
  FileTrigger,
  type Key,
  type Selection
} from 'react-aria-components'
import {configAtom} from '../atoms/core.js'
import {
  type DashboardEntry,
  type DashboardEntryData,
  type DashboardExplorer,
  explorerPageIsPending,
  type ExplorerReadyPage,
  type ExplorerSort,
  type ExplorerSortBy,
  type ExplorerTypeFilters
} from '../atoms/explorer.js'
import {
  IcRoundAccountTree,
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundClose,
  IcRoundFilterList,
  IcRoundUploadFile
} from '../icons.js'
import {EditorBackButton} from './EditorBackButton.js'
import css from './Explorer.module.css'
import {ExplorerList} from './ExplorerList.js'
import {LocaleMenu} from './LocaleMenu.js'
import {ActivityStatus} from './ActivityStatus.js'
import {RailBody, RailHeader} from './ui/Rail.js'

const styles = styler(css)

export interface ExplorerProps {
  controls?: ReactNode
  explorer: DashboardExplorer
  headerEntry?: ExplorerHeaderEntry
  page: ExplorerReadyPage
  titleControls?: ReactNode
}

export interface ExplorerHeaderEntry {
  backLabel: string
  title: string
  onBack(): void
}

export interface ExplorerHeaderProps {
  autoFocusSearch?: boolean
  controls?: ReactNode
  explorer: DashboardExplorer
  headerEntry?: ExplorerHeaderEntry
  navigate?: boolean
  page: ExplorerReadyPage
  titleControls?: ReactNode
}

export interface ExplorerBodyProps {
  compactTable?: boolean
  explorer: DashboardExplorer
  onSelectionChange?: (selection: Selection) => void
  page: ExplorerReadyPage
}

interface ExplorerSearchProps {
  autoFocus?: boolean
  explorer: DashboardExplorer
  onEntryAction?: (entry: DashboardEntry) => void
  page: ExplorerReadyPage
}

interface ExplorerHeaderMainProps {
  explorer: DashboardExplorer
  headerEntry?: ExplorerHeaderEntry
  page: ExplorerReadyPage
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

export function ExplorerSearch({
  autoFocus,
  explorer,
  onEntryAction,
  page
}: ExplorerSearchProps) {
  const items = page.items
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

  const selectedEntry = useMemo(() => {
    if (selection === 'all') return undefined
    const [selected] = selection
    if (selected === undefined) return undefined
    return items.find(item => item.id === String(selected))
  }, [items, selection])

  // Search results resolve asynchronously, so selection must be reconciled
  // after the result set changes.
  // eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change
  // eslint-disable react-you-might-not-need-an-effect/no-event-handler
  useEffect(() => {
    if (!explorer.autoSelectFirstItem || !explorer.hasSelection) return
    if (items.length === 0) {
      if (selection !== 'all' && selection.size > 0)
        setSelection(new Set<Key>())
      return
    }
    if (!selectedEntry) setSelection(new Set<Key>([items[0].id]))
  }, [
    explorer.autoSelectFirstItem,
    explorer.hasSelection,
    items,
    selectedEntry,
    selection,
    setSelection
  ])
  // eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change
  // eslint-enable react-you-might-not-need-an-effect/no-event-handler

  function onSearchChange(value: string) {
    setInputValue(value)
    startTransition(() => {
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
        selectedEntry ?? (explorer.autoSelectFirstItem ? items[0] : undefined)
      if (!entry) return
      event.preventDefault()
      if (onEntryAction) onEntryAction(entry)
      else performAction(entry, page.locale)
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

interface ExplorerSearchScopeProps {
  explorer: DashboardExplorer
  page: ExplorerReadyPage
}

function ExplorerSearchScope({explorer, page}: ExplorerSearchScopeProps) {
  const searchScope = page.searchScope
  const setSearchScope = useSetAtom(explorer.searchScope)
  const resultMode = page.resultMode
  const canSearchEverything = useAtomValue(explorer.canSearchEverything)
  const [, startTransition] = useTransition()
  if (!explorer.allowAllWorkspaces) return null
  const isDisabled =
    !canSearchEverything ||
    (explorer.mode !== 'search' && resultMode !== 'matches')
  return (
    <Switch
      className={styles.Explorer.searchScope()}
      isDisabled={isDisabled}
      isSelected={searchScope === 'everything'}
      onChange={selected =>
        startTransition(() =>
          setSearchScope(selected ? 'everything' : 'workspace')
        )
      }
    >
      All locations
    </Switch>
  )
}

interface ExplorerResultModeProps {
  explorer: DashboardExplorer
  page: ExplorerReadyPage
}

function ExplorerResultMode({explorer, page}: ExplorerResultModeProps) {
  const resultMode = page.resultMode
  const setResultMode = useSetAtom(explorer.resultMode)
  const search = useAtomValue(explorer.search)
  const [, startTransition] = useTransition()
  const canShowFiltered =
    explorer.pickChildren || explorer.hasCondition || Boolean(search.trim())
  const canBrowse = !explorer.pickChildren && !search.trim()
  return (
    <ToggleButtonGroup
      aria-label="Explorer results"
      className={styles.Explorer.resultMode()}
      disallowEmptySelection
      selectedKeys={[resultMode]}
      selectionMode="single"
      variant="compact"
      onSelectionChange={(keys: Set<Key>) => {
        const next = keys.has('matches') ? 'matches' : 'browse'
        if (!canBrowse && next === 'browse') return
        startTransition(() => {
          setResultMode(next)
        })
      }}
    >
      <ToggleButton id="browse" isDisabled={!canBrowse}>
        <IcRoundAccountTree aria-hidden data-slot="icon" />
        Browse
      </ToggleButton>
      <ToggleButton id="matches" isDisabled={!canShowFiltered}>
        <IcRoundFilterList aria-hidden data-slot="icon" />
        Filtered
      </ToggleButton>
    </ToggleButtonGroup>
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
  headerEntry,
  page,
  titleControls
}: ExplorerHeaderMainProps) {
  const parent = useAtomValue(explorer.parent(page.location, page.locale))
  if (headerEntry) {
    return (
      <div className={styles.ExplorerHeader.main()}>
        <EditorBackButton
          label={headerEntry.backLabel}
          onPress={headerEntry.onBack}
        />
        <h1 className={styles.ExplorerHeader.title()}>{headerEntry.title}</h1>
        {titleControls}
      </div>
    )
  }
  if (parent) {
    return (
      <ExplorerHeaderParentMain
        parent={parent}
        explorer={explorer}
        titleControls={titleControls}
      />
    )
  }
  if (titleControls) {
    return <div className={styles.ExplorerHeader.main()}>{titleControls}</div>
  }
  return null
}

interface ExplorerLocationMenuProps {
  explorer: DashboardExplorer
  lockNavigation?: boolean
  page: ExplorerReadyPage
}

interface ExplorerLocationParentsProps {
  explorer: DashboardExplorer
  lockNavigation: boolean
  parent: DashboardEntry
}

function ExplorerLocationParents({
  explorer,
  lockNavigation,
  parent
}: ExplorerLocationParentsProps) {
  const {data} = useAtomValue(parent.data)
  if (!data) return null
  return (
    <ExplorerLoadedLocationParents
      data={data}
      explorer={explorer}
      lockNavigation={lockNavigation}
      parent={parent}
    />
  )
}

interface ExplorerLoadedLocationParentsProps {
  data: DashboardEntryData
  explorer: DashboardExplorer
  lockNavigation: boolean
  parent: DashboardEntry
}

function ExplorerLoadedLocationParents({
  data,
  explorer,
  lockNavigation,
  parent
}: ExplorerLoadedLocationParentsProps) {
  const parents = useAtomValue(data.parents)
  return [...parents, parent].map((entry, index, entries) => (
    <ExplorerLocationParent
      current={index === entries.length - 1}
      entry={entry}
      explorer={explorer}
      key={entry.id}
      lockNavigation={lockNavigation}
    />
  ))
}

interface ExplorerLocationParentProps {
  current: boolean
  entry: DashboardEntry
  explorer: DashboardExplorer
  lockNavigation: boolean
}

function ExplorerLocationParent({
  current,
  entry,
  explorer,
  lockNavigation
}: ExplorerLocationParentProps) {
  const {data} = useAtomValue(entry.data)
  if (!data) return null
  return (
    <ExplorerLoadedLocationParent
      current={current}
      data={data}
      entry={entry}
      explorer={explorer}
      lockNavigation={lockNavigation}
    />
  )
}

interface ExplorerLoadedLocationParentProps {
  current: boolean
  data: DashboardEntryData
  entry: DashboardEntry
  explorer: DashboardExplorer
  lockNavigation: boolean
}

function ExplorerLoadedLocationParent({
  current,
  data,
  entry,
  explorer,
  lockNavigation
}: ExplorerLoadedLocationParentProps) {
  const label = useAtomValue(data.label)
  const setLocation = useSetAtom(explorer.location)
  return (
    <>
      <span
        aria-hidden="true"
        className={styles.Explorer.locationBreadcrumbs.separator()}
      >
        ›
      </span>
      {current || lockNavigation ? (
        <span
          className={
            current
              ? styles.Explorer.locationBreadcrumbs.current()
              : styles.Explorer.locationBreadcrumbs.parentValue()
          }
        >
          {label}
        </span>
      ) : (
        <Button
          appearance="plain"
          className={styles.Explorer.locationBreadcrumbs.parentAction()}
          onPress={() =>
            setLocation(location => ({...location, parentId: entry.id}))
          }
        >
          {label}
        </Button>
      )}
    </>
  )
}

function ExplorerLocationMenu({
  explorer,
  lockNavigation = false,
  page
}: ExplorerLocationMenuProps) {
  const config = useAtomValue(configAtom)
  const location = page.location
  const policy = useAtomValue(policyAtom)
  const selectedLocale = page.locale
  const setSelectedLocale = useSetAtom(explorer.selectedLocale)
  const setLocation = useSetAtom(explorer.location)
  const parent = useAtomValue(explorer.parent(location, selectedLocale))
  const configuredLocations = explorer.limitLocations?.length
    ? explorer.limitLocations
    : Object.entries(config.workspaces).flatMap(([workspace, value]) =>
        Object.keys(getWorkspace(value).roots).map(root => ({workspace, root}))
      )
  const visibleLocations = configuredLocations.filter(location =>
    policy.canRead(location)
  )
  const locations = visibleLocations.map(candidate => {
    const workspace = config.workspaces[candidate.workspace]
    const workspaceLabel = workspace
      ? getWorkspace(workspace).label
      : candidate.workspace
    const root = workspace
      ? getWorkspace(workspace).roots[candidate.root]
      : undefined
    const rootData = root ? getRoot(root) : undefined
    const rootLabel = rootData?.label ?? candidate.root
    const locales: ReadonlyArray<string> = rootData?.i18n?.locales ?? []
    return {
      ...candidate,
      locales,
      rootLabel,
      workspaceLabel
    }
  })
  const selected = locations.find(
    candidate =>
      candidate.workspace === location.workspace &&
      candidate.root === location.root
  )
  const workspaces = Array.from(
    new Map(
      locations.map(candidate => [
        candidate.workspace,
        {
          key: candidate.workspace,
          label: candidate.workspaceLabel
        }
      ])
    ).values()
  )
  const roots = locations.filter(
    candidate => candidate.workspace === location.workspace
  )
  const locales = selected?.locales ?? []
  const localeRoot = selected
    ? rootAtoms(selected.workspace, selected.root)
    : undefined

  function selectLocation(candidate: (typeof locations)[number]) {
    const locale = candidate.locales.includes(selectedLocale ?? '')
      ? selectedLocale
      : (candidate.locales[0] ?? null)
    setSelectedLocale(locale)
    setLocation({
      workspace: candidate.workspace,
      root: candidate.root,
      locale: locale ?? undefined
    })
  }

  function selectLocale(locale: string) {
    setSelectedLocale(locale)
    setLocation(current => ({...current, locale}))
  }

  return (
    <div className={styles.Explorer.locationBreadcrumbs()}>
      <div className={styles.Explorer.locationBreadcrumbs.item()}>
        {workspaces.length > 1 && !lockNavigation ? (
          <Menu
            appearance="plain"
            label={selected?.workspaceLabel ?? location.workspace}
            selectionMode="single"
            selectedKeys={[location.workspace]}
            onAction={key => {
              const workspace = String(key)
              const next =
                locations.find(
                  candidate =>
                    candidate.workspace === workspace &&
                    candidate.root === location.root
                ) ??
                locations.find(candidate => candidate.workspace === workspace)
              if (!next) return
              selectLocation(next)
            }}
          >
            {workspaces.map(workspace => (
              <MenuItem
                id={workspace.key}
                key={workspace.key}
                textValue={workspace.label}
              >
                {workspace.label}
              </MenuItem>
            ))}
          </Menu>
        ) : (
          <span className={styles.Explorer.locationBreadcrumbs.value()}>
            {selected?.workspaceLabel}
          </span>
        )}
      </div>
      <span
        aria-hidden="true"
        className={styles.Explorer.locationBreadcrumbs.separator()}
      >
        ›
      </span>
      <div className={styles.Explorer.locationBreadcrumbs.root()}>
        <div className={styles.Explorer.locationBreadcrumbs.item()}>
          {roots.length > 1 && !lockNavigation ? (
            <Menu
              appearance="plain"
              label={selected?.rootLabel ?? location.root ?? 'Select root'}
              selectionMode="single"
              selectedKeys={location.root ? [location.root] : []}
              onAction={key => {
                const root = String(key)
                const next = roots.find(candidate => candidate.root === root)
                if (next) selectLocation(next)
              }}
            >
              {roots.map(root => (
                <MenuItem
                  id={root.root}
                  key={root.root}
                  textValue={root.rootLabel}
                >
                  {root.rootLabel}
                </MenuItem>
              ))}
            </Menu>
          ) : (
            <span className={styles.Explorer.locationBreadcrumbs.value()}>
              {selected?.rootLabel ?? location.root ?? 'Select root'}
            </span>
          )}
        </div>
        {localeRoot && locales.length > 1 && (
          <div className={styles.Explorer.locationBreadcrumbs.root.locale()}>
            {lockNavigation ? (
              <span
                className={styles.Explorer.locationBreadcrumbs.localeValue()}
              >
                {(selectedLocale ?? locales[0])?.toUpperCase()}
              </span>
            ) : (
              <LocaleMenu
                root={localeRoot}
                locale={selectedLocale}
                onLocaleChange={selectLocale}
              />
            )}
          </div>
        )}
      </div>
      {parent && (
        <ExplorerLocationParents
          explorer={explorer}
          lockNavigation={lockNavigation}
          parent={parent}
        />
      )}
    </div>
  )
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
  page: ExplorerReadyPage
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

function ExplorerToolbar({explorer, page}: ExplorerToolbarProps) {
  const [, setView] = useAtom(explorer.view)
  const [sort, setSort] = useAtom(explorer.sort)
  const [selectedFilter, toggleFilter] = useAtom(explorer.filter)
  const requestedLocation = useAtomValue(explorer.location)
  const selectedLocale = useAtomValue(explorer.selectedLocale)
  const locationIsPending = explorerPageIsPending(
    page,
    requestedLocation,
    selectedLocale
  )
  const canUpload = useAtomValue(explorer.canUpload)
  const uploads = useAtomValue(explorer.uploadsInCurrentFolder)
  const upload = useSetAtom(explorer.upload)
  const uploadCount = uploads.length
  const uploadLabel =
    uploadCount === 1 ? '1 file uploading' : `${uploadCount} files uploading`

  return (
    <div className={styles.Explorer.toolbar.tools()}>
      {page.isMedia && uploadCount > 0 && (
        <ActivityStatus ariaLabel={uploadLabel} placement="bottom">
          {uploadCount}
        </ActivityStatus>
      )}
      <ExplorerControlsButton
        isMedia={page.isMedia}
        sort={sort}
        selectedFilter={selectedFilter}
        setSort={setSort}
        toggleFilter={toggleFilter}
      />
      <div className={styles.Explorer.toolbar.mediaActions()}>
        <ViewToggle view={page.view} setView={setView} />
        {page.isMedia && canUpload && !locationIsPending && (
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
  headerEntry,
  navigate,
  page,
  titleControls
}: ExplorerHeaderProps) {
  return (
    <RailHeader className={styles.ExplorerHeader({navigation: navigate})}>
      <div className={styles.ExplorerHeader.content()}>
        <div className={styles.ExplorerHeader.primary()}>
          {!navigate && (
            <ExplorerHeaderMain
              explorer={explorer}
              headerEntry={headerEntry}
              page={page}
              titleControls={titleControls}
            />
          )}
          <div className={styles.Explorer.searchSlot()}>
            <ExplorerSearch
              autoFocus={autoFocusSearch}
              explorer={explorer}
              page={page}
            />
            <ExplorerSearchScope explorer={explorer} page={page} />
          </div>
          <div className={styles.Explorer.toolbar()}>
            <ExplorerToolbar explorer={explorer} page={page} />
            {controls}
          </div>
        </div>
        {navigate && (
          <div
            aria-label="Explorer location"
            className={styles.ExplorerHeader.location()}
            role="group"
          >
            <ExplorerResultMode explorer={explorer} page={page} />
            {!page.searchesEverything && (
              <ExplorerLocationMenu
                explorer={explorer}
                lockNavigation={explorer.pickChildren}
                page={page}
              />
            )}
          </div>
        )}
      </div>
    </RailHeader>
  )
}

export function ExplorerBody({
  compactTable,
  explorer,
  onSelectionChange,
  page
}: ExplorerBodyProps) {
  return (
    <RailBody>
      <div className={styles.Explorer.viewport()}>
        <ExplorerList
          compactTable={compactTable}
          explorer={explorer}
          onSelectionChange={onSelectionChange}
          page={page}
        />
      </div>
    </RailBody>
  )
}

export function Explorer({
  controls,
  explorer,
  headerEntry,
  page: loadedPage,
  titleControls
}: ExplorerProps) {
  const resolvedPage = useAtomValue(explorer.page)
  const page = resolvedPage ?? loadedPage
  return (
    <>
      <ExplorerHeader
        controls={controls}
        explorer={explorer}
        headerEntry={headerEntry}
        page={page}
        titleControls={titleControls}
      />
      <ExplorerBody explorer={explorer} page={page} />
    </>
  )
}
