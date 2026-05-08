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
import css from './Explorer.module.css'
import {ExplorerList} from './ExplorerList.js'
import {LocationBreadcrumbs} from './LocationBreadcrumbs.js'
import {MutationQueueStatus} from './MutationQueueStatus.js'
import {RailBody, RailHeader} from './ui/Rail.js'

const styles = styler(css)

export interface ExplorerProps {
  explorer: DashboardExplorer
}

export interface ExplorerHeaderProps {
  controls?: ReactNode
  explorer: DashboardExplorer
}

export interface ExplorerBodyProps {
  explorer: DashboardExplorer
}

interface ExplorerSearchProps {
  explorer: DashboardExplorer
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

interface ExplorerToolbarProps {
  explorer: DashboardExplorer
}
const filters: Array<{type: ExplorerTypeFilters; label: string}> = [
  {type: MediaFile, label: 'File'},
  {type: MediaLibrary, label: 'Folder'}
]
const sortingOptions: Array<{id: ExplorerSortBy; label: string}> = [
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

export function ExplorerHeader({controls, explorer}: ExplorerHeaderProps) {
  const [location, setLocation] = useAtom(explorer.location)
  return (
    <RailHeader className={styles.Explorer.bar()}>
      <div className={styles.Explorer.breadcrumbs()}>
        <LocationBreadcrumbs
          location={location}
          setLocation={setLocation}
          enableRoot
        />
      </div>
      <div className={styles.Explorer.searchSlot()}>
        <ExplorerSearch explorer={explorer} />
      </div>
      <div className={styles.Explorer.toolbar()}>
        <ExplorerToolbar explorer={explorer} />
        {controls}
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

export function Explorer({explorer}: ExplorerProps) {
  return (
    <>
      <ExplorerHeader explorer={explorer} />
      <ExplorerBody explorer={explorer} />
    </>
  )
}
