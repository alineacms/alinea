import {Button, Popover, SearchField} from '#/components.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {slugify} from '#/core/util/Slugs.js'
import {ViewToggle} from '#/dashboard/app/ViewToggle.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import type {ReactNode} from 'react'
import {DialogTrigger, FileTrigger} from 'react-aria-components'
import {
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundClose,
  IcRoundFilterList,
  IcRoundUploadFile
} from '../icons.js'
import {
  DashboardExplorer,
  ExplorerSort,
  ExplorerSortBy,
  ExplorerTypeFilters
} from '../store.js'
import type {
  DashboardEntry,
  DashboardEntryData,
  DashboardRoot
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
  controls?: ReactNode
  explorer: DashboardExplorer
  titleControls?: ReactNode
}

export interface ExplorerBodyProps {
  explorer: DashboardExplorer
}

interface ExplorerSearchProps {
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

interface ExplorerHeaderRootMainProps {
  root: DashboardRoot
  titleControls?: ReactNode
}

function ExplorerSearch({explorer}: ExplorerSearchProps) {
  const [search, setSearch] = useAtom(explorer.search)
  return (
    <SearchField
      aria-label="Search"
      className={styles.Explorer.search()}
      hasIcon
      placeholder="Search..."
      value={search}
      onChange={setSearch}
    />
  )
}

function ExplorerHeaderRootMain({
  root,
  titleControls
}: ExplorerHeaderRootMainProps) {
  const label = useAtomValue(root.label)
  return (
    <div className={styles.ExplorerHeader.main()}>
      <h1 className={styles.ExplorerHeader.title()}>{label}</h1>
      {titleControls}
    </div>
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
  if (root)
    return (
      <ExplorerHeaderRootMain root={root} titleControls={titleControls} />
    )
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
  controls,
  explorer,
  titleControls
}: ExplorerHeaderProps) {
  return (
    <RailHeader className={styles.ExplorerHeader()}>
      <div className={styles.ExplorerHeader.content()}>
        <ExplorerHeaderMain explorer={explorer} titleControls={titleControls} />
        <div className={styles.Explorer.searchSlot()}>
          <ExplorerSearch explorer={explorer} />
        </div>
        <div className={styles.Explorer.toolbar()}>
          {controls}
          <ExplorerToolbar explorer={explorer} />
        </div>
      </div>
    </RailHeader>
  )
}

export function ExplorerBody({explorer}: ExplorerBodyProps) {
  const items = useAtomValue(explorer.itemsResource)
  return (
    <RailBody>
      <div className={styles.Explorer.viewport()}>
        <ExplorerList explorer={explorer} items={items} />
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
