import type {DragTypes, DropTarget, Key} from '#/components.js'
import type {Config} from '#/core/Config.js'
import {Entry, type EntryStatus} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import {filterChecker} from '#/core/Filter.js'
import {Field} from '#/core/Field.js'
import type {Filter} from '#/core/Filter.js'
import type {Graph, GraphQuery} from '#/core/Graph.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import type {OverviewSort} from '#/core/Overview.js'
import {Permission, type Policy, type Resource} from '#/core/Role.js'
import type {RootData} from '#/core/Root.js'
import {Type} from '#/core/Type.js'
import {chunks} from '#/core/util/Arrays.js'
import type {Infer} from '#/types.js'
import {parents} from '#/query.js'
import {
  atom,
  type Atom,
  type Getter,
  type PrimitiveAtom,
  type WritableAtom
} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {ComponentType, SetStateAction} from 'react'
import {LucideFile} from '../icons.js'
import {activityAtom} from './activity.js'
import {configAtom, graphAtom} from './core.js'
import {MissingEntryError, treeEntryAtoms} from './entry.js'
import {
  columnLinkIds,
  loadColumnValues,
  loadOverviewParent,
  overviewFilter,
  type OverviewFilterSelection,
  type OverviewFilterState,
  overviewOrder,
  type OverviewState,
  pickedFilters,
  pickedSort,
  resolveOverview,
  sortedColumn,
  summarizeRows,
  thumbnailField
} from './overview.js'
import {shaAtom} from './graph.js'
import {routeAtom} from './nav.js'
import {requestUploadsAtom} from './upload.js'
import {policyAtom} from './user.js'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDragItem,
  dispense,
  moveEntries
} from './utils.js'

/** The best ranked matches a search loads into the explorer. */
export const searchResultLimit = 100

export type ExplorerView = 'card' | 'row'

export interface ExplorerLocation {
  workspace: string
  root?: string
  parentId?: string
  locale?: string
}

export interface ExplorerLimitLocation {
  workspace: string
  root: string
}

function constrainLocation(
  location: ExplorerLocation,
  limits: Array<ExplorerLimitLocation> | undefined
): ExplorerLocation {
  if (!limits?.length) return location
  if (
    limits.some(
      limit =>
        limit.workspace === location.workspace && limit.root === location.root
    )
  )
    return location
  const sameWorkspace = limits.find(
    limit => limit.workspace === location.workspace
  )
  if (sameWorkspace)
    return {workspace: sameWorkspace.workspace, root: sameWorkspace.root}
  const [fallback] = limits
  return fallback
    ? {workspace: fallback.workspace, root: fallback.root}
    : location
}

export interface ExplorerOptions {
  allowAllWorkspaces?: boolean
  autoSelectFirstItem?: boolean
  breadcrumbs?: boolean
  /** Entries that match the condition can be selected when this allows it */
  canSelect?: (item: ExplorerItemData) => boolean
  condition?: Filter<EntryFields>
  enableNavigation?: boolean
  initialView?: ExplorerView
  initialResultMode?: ExplorerResultMode
  initialSearchScope?: 'workspace' | 'everything'
  location?: ExplorerLocation
  limitLocations?: Array<ExplorerLimitLocation>
  mode?: 'browse' | 'search'
  nestedNavigation?: boolean
  pickChildren?: boolean
  rootData?: Atom<RootData>
  /**
   * Keeps the scroll offset of the listed results by `explorerScrollKey`,
   * share it between explorers that list the same locations. Defaults to state
   * kept by the explorer.
   */
  scrollOffset?: (key: string) => PrimitiveAtom<number>
  treeReady?: (
    locale: string | null,
    location: ExplorerLocation
  ) => Atom<Promise<unknown>>
  selectedLocaleAtom?: WritableAtom<
    string | null,
    [SetStateAction<string | null>],
    void
  >
  selectedLocale?: string | null
  selectionMode?: 'none' | 'single' | 'multiple'
  selectionBehavior?: 'toggle' | 'replace'
  /**
   * The column the editor sorted by, defaults to state kept by the explorer.
   * Page explorers keep it in the url.
   */
  sortState?: WritableAtom<
    OverviewSort | undefined,
    [OverviewSort | undefined],
    void
  >
  /**
   * The filter options the editor picked, defaults to state kept by the
   * explorer. The explorers of a root share them.
   */
  filterState?: PrimitiveAtom<OverviewFilterSelection>
  showSelectionControls?: boolean
  initialSelection?: Array<string>
  /**
   * Whether the matches in a folder are limited to its children, or cover
   * the whole root. Defaults to the folder in browse mode.
   */
  searchDepth?: 'current' | 'all'
  onAction?: (entry: ExplorerEntry) => void
  onConfirm?: (selection: Array<string>, locale: string | null) => void
  preselect?: boolean
}

/** An entry on the way from the root to the listed location */
export interface ExplorerPathEntry {
  id: string
  title: string
}

/** The entry whose children are listed */
export interface ExplorerParent extends ExplorerPathEntry {
  /** The ids of its parents, from the root down */
  parents: Array<string>
  /** Its parents the editor can see, from the root down */
  path: Array<ExplorerPathEntry>
}

export type ExplorerResultMode = 'browse' | 'matches'

type ExplorerQuery = GraphQuery<undefined, Type | undefined, undefined>

/** How the listed entries are ordered */
export interface ExplorerSortState {
  /** The column the editor sorted by */
  requested?: OverviewSort
  /** The label of the order the editor picked */
  label?: string
  /** The column shown as sorted, also for the parent's default order */
  column?: OverviewSort
  /** Entries are listed in their stored order and can be reordered */
  manual: boolean
}

export interface ExplorerReadyPage {
  canUpload: boolean
  /** The filter options the listed entries match, by filter key */
  filters: OverviewFilterSelection
  isMedia: boolean
  items: Array<ExplorerEntry>
  locale: string | null
  location: ExplorerLocation
  /** The entry the location lists the children of, undefined at a root */
  parent: ExplorerParent | undefined
  overview: OverviewState
  /** The query of the listed entries, without selection and paging */
  query: ExplorerQuery
  root: ExplorerRootData
  resultMode: ExplorerResultMode
  search: string
  searchScope: 'workspace' | 'everything'
  searchesEverything: boolean
  sort: ExplorerSortState
  view: ExplorerView
}

export function explorerPageIsPending(
  page: ExplorerReadyPage,
  location: ExplorerLocation,
  locale: string | null
) {
  return (
    page.locale !== locale ||
    page.location.workspace !== location.workspace ||
    page.location.root !== location.root ||
    page.location.parentId !== location.parentId
  )
}

/**
 * Whether an entry is listed where it lives, so its location repeats the
 * place the page already shows
 */
export function isAtLocation(
  entry: ExplorerEntry,
  parents: Array<ExplorerEntry>,
  page: ExplorerReadyPage
): boolean {
  const {location} = page
  return (
    !page.searchesEverything &&
    entry.workspace === location.workspace &&
    entry.root === location.root &&
    parents.at(-1)?.id === location.parentId
  )
}

/**
 * Identifies the listed results of a page: pages with the same key list the
 * same entries in the same way and share their scroll offset
 */
export function explorerScrollKey(page: ExplorerReadyPage) {
  const {location} = page
  return JSON.stringify([
    location.workspace,
    location.root ?? null,
    location.parentId ?? null,
    page.locale,
    page.view,
    page.resultMode,
    page.searchScope,
    page.search.trim(),
    page.filters
  ])
}

export interface ExplorerItemData {
  active?: boolean
  createdAt?: number | null
  id: string
  status?: EntryStatus
  /** The draft is the only version, the entry was never published */
  main?: boolean
  title: string
  path: string
  updatedAt?: number | null
  url?: string
  type: string
  workspace: string
  root: string
  locale: string | null
  parentId: string | null
  parents: Array<string>
  /** Set for entries seeded by the config, these can not move or be removed */
  seeded?: string | null
  parentEntries?: Array<{
    id: string
    title: string
    type: string
    workspace: string
    root: string
    locale: string | null
    parentId: string | null
  }>
  index: string
  data: Record<string, unknown>
  hasChildren: boolean
  /** The values of the overview columns that are queried, by column key */
  columns?: Record<string, unknown>
  /** Summaries of the entries linked from the overview columns, by id */
  linked?: Record<string, ExplorerLinkedEntry>
  /** The first image found in the entry's fields */
  thumbnail?: ExplorerLinkedEntry
}

/** What the explorer shows of an entry linked from another entry */
export interface ExplorerLinkedEntry {
  id: string
  title: string
  /** A small data url preview of an image */
  preview?: string
  averageColor?: string
}

/**
 * The id of the first image an entry links to, following the order of the
 * type's fields and the items within them (eg. a gallery). Returns undefined
 * if the entry has no images.
 */
export function explorerThumbnailId(
  type: Type,
  data: Record<string, unknown>
): string | undefined {
  return Type.references(type, data).find(
    reference => reference.linkType === 'image'
  )?.targetId
}

interface LinkedEntryRow extends ExplorerLinkedEntry {
  locale: string | null
}

function pickLinkedEntry(
  rows: Array<LinkedEntryRow> | undefined,
  locale: string | null
): ExplorerLinkedEntry | undefined {
  if (!rows?.length) return undefined
  const row =
    rows.find(row => row.locale === locale) ??
    rows.find(row => row.locale === null) ??
    rows[0]
  return {
    id: row.id,
    title: row.title,
    preview: row.preview || undefined,
    averageColor: row.averageColor || undefined
  }
}

/** The id of the image shown on the card of an entry */
function cardThumbnailId(
  get: Getter,
  overview: OverviewState,
  item: ExplorerItemData
): string | undefined {
  const config = get(configAtom)
  const type = config.schema[item.type]
  if (!type) return undefined
  const configured = thumbnailField(config, overview, item.type)
  if (!configured) return explorerThumbnailId(type, item.data)
  const [name, field] = configured
  const label = Field.label(field)
  return Field.references(field, item.data[name], {
    path: [name],
    label,
    labels: [label]
  }).find(reference => reference.linkType === 'image')?.targetId
}

/**
 * Loads the thumbnails and the entries linked from the overview columns of
 * the given explorer items in a single query
 */
export async function withLinkedEntries<Item extends ExplorerItemData>(
  get: Getter,
  overview: OverviewState,
  items: Array<Item>,
  thumbnails = true
): Promise<Array<Item>> {
  const config = get(configAtom)
  const schema = config.schema
  const wanted = items.map(item => {
    const type = schema[item.type]
    if (!type || type === MediaFile || type === MediaLibrary)
      return {thumbnail: undefined, links: []}
    return {
      thumbnail: thumbnails ? cardThumbnailId(get, overview, item) : undefined,
      links: columnLinkIds(config, overview, item)
    }
  })
  const ids = Array.from(
    new Set(
      wanted.flatMap(({thumbnail, links}) =>
        thumbnail ? [thumbnail, ...links] : links
      )
    )
  )
  if (ids.length === 0) return items
  const graph = get(graphAtom)
  const policy = get(policyAtom)
  const rows = await graph.find({
    id: {in: ids},
    status: 'preferDraft',
    select: {
      id: Entry.id,
      title: Entry.title,
      workspace: Entry.workspace,
      root: Entry.root,
      locale: Entry.locale,
      parents: Entry.parents,
      preview: MediaFile.preview,
      averageColor: MediaFile.averageColor
    }
  })
  const byId = new Map<string, Array<LinkedEntryRow>>()
  for (const row of rows) {
    if (!policy.canRead(row)) continue
    const versions = byId.get(row.id) ?? []
    versions.push(row as LinkedEntryRow)
    byId.set(row.id, versions)
  }
  return items.map((item, index) => {
    const {thumbnail, links} = wanted[index]
    const linked: Record<string, ExplorerLinkedEntry> = {}
    for (const id of links) {
      const entry = pickLinkedEntry(byId.get(id), item.locale)
      if (entry) linked[id] = entry
    }
    const image = thumbnail
      ? pickLinkedEntry(byId.get(thumbnail), item.locale)
      : undefined
    return {
      ...item,
      linked,
      thumbnail: image?.preview ? image : undefined
    }
  })
}

function explorerItemField(item: ExplorerItemData, name: string) {
  if (!name.startsWith('_')) return item.data[name]
  const entry = item as unknown as Record<string, unknown>
  return entry[name.slice(1)]
}

/** The selected entry can be moved to another parent */
export function explorerItemCanMove(policy: Policy, item: ExplorerItemData) {
  return !item.seeded && policy.canMove(item)
}

/** The selected entry can be deleted, in the language it is listed in */
export function explorerItemCanDelete(policy: Policy, item: ExplorerItemData) {
  return !item.seeded && policy.canDelete(item)
}

export interface ExplorerSelectionActions {
  /** The selected entries that are listed */
  items: Array<ExplorerItemData>
  /** The selected entries the editor may move, all within one root */
  movable: Array<ExplorerItemData>
  /** The selected entries the editor may delete */
  deletable: Array<ExplorerItemData>
}

export interface ExplorerRootData {
  icon: Atom<ComponentType>
  label: Atom<string>
}

export interface ExplorerTypeData {
  label: string
}

export class ExplorerEntryData {
  label = atom(get => get(this.item).title)
  hasChildren = atom(get => get(this.item).hasChildren)
  canOpen = atom(get => {
    const item = get(this.item)
    if (item.hasChildren) return true
    const type = get(configAtom).schema[item.type]
    return Boolean(type && Type.isContainer(type))
  })
  parents: Atom<Array<ExplorerEntry>>
  root: Atom<ExplorerRootData>
  icon = atom((get): ComponentType | undefined => {
    const item = get(this.item)
    const type = get(configAtom).schema[item.type]
    return type ? getType(type).icon : undefined
  })
  type = atom((get): ExplorerTypeData => {
    const item = get(this.item)
    const type = get(configAtom).schema[item.type]
    return {label: type ? String(Type.label(type)) : item.type}
  })
  fileInfo = atom((get): Infer<typeof MediaFile> | null => {
    const item = get(this.item)
    const type = get(configAtom).schema[item.type]
    return type === MediaFile ? (item.data as Infer<typeof MediaFile>) : null
  })
  linked = atom(
    (get): ReadonlyMap<string, ExplorerLinkedEntry> =>
      new Map(Object.entries(get(this.item).linked ?? {}))
  )
  thumbnail = atom(get => get(this.item).thumbnail)

  constructor(
    public readonly item: Atom<ExplorerItemData>,
    _root: Atom<ExplorerRootData>,
    parents: Array<ExplorerEntry> = []
  ) {
    const configuredRoot = (get: Getter) => {
      const value = get(this.item)
      const workspace = get(configAtom).workspaces[value.workspace]
      const rootConfig = workspace
        ? getWorkspace(workspace).roots[value.root]
        : undefined
      return rootConfig ? getRoot(rootConfig) : undefined
    }
    const icon = atom(get => {
      const data = configuredRoot(get)
      return data?.icon ?? LucideFile
    })
    const label = atom(get => {
      const data = configuredRoot(get)
      return data?.label ?? get(this.item).root
    })
    this.root = atom({icon, label})
    this.parents = atom(parents)
  }
}

export class ExplorerEntry {
  readonly title: string
  readonly hasChildren: boolean
  readonly workspace: string
  readonly root: string
  readonly locale: string | null
  data: Atom<{
    pending: false
    data: ExplorerEntryData
    error: undefined
  }>

  constructor(
    public readonly id: string,
    value: ExplorerItemData,
    item: Atom<ExplorerItemData>,
    root: Atom<ExplorerRootData>,
    parents: Array<ExplorerEntry> = []
  ) {
    this.title = value.title
    this.hasChildren = value.hasChildren
    this.workspace = value.workspace
    this.root = value.root
    this.locale = value.locale
    const data = new ExplorerEntryData(item, root, parents)
    this.data = atom({pending: false, data, error: undefined})
  }
}

/** Where files uploaded to a location are placed */
function uploadResource(
  location: ExplorerLocation,
  parent: ExplorerParent | undefined
): Resource {
  return {
    workspace: location.workspace,
    root: location.root,
    id: location.parentId,
    parents: parent?.parents
  }
}

let explorerCount = 0

export class ExplorerAtoms {
  /** The id of the element that contains the results */
  readonly resultsId = `alinea-explorer-results-${++explorerCount}`
  readonly allowAllWorkspaces
  readonly selectionMode
  readonly selectionBehavior
  readonly showSelectionControls
  readonly breadcrumbs
  readonly autoSelectFirstItem
  readonly rootScope: 'current' | 'workspace'
  readonly hasRowAction
  readonly mode: 'browse' | 'search'
  readonly hasSelection
  readonly linkedKeys: ReadonlySet<Key>
  readonly searchDepth
  readonly supportsInlineExpansion
  readonly pickChildren
  readonly hasCondition
  readonly canSearchEverything: Atom<boolean>
  readonly searchesEverything: Atom<boolean>

  search = atom('')
  searchScope: PrimitiveAtom<'workspace' | 'everything'>
  resultMode: WritableAtom<ExplorerResultMode, [ExplorerResultMode], void>
  selection: PrimitiveAtom<'all' | Set<Key>>
  expandedKeys = atom(new Set<Key>())
  sidebarExpandedKeys = atom(new Set<string>())
  #selectedResultMode: PrimitiveAtom<ExplorerResultMode>
  #selectedView: PrimitiveAtom<ExplorerView | undefined>
  /** The column the editor sorted by, undefined for the default order */
  requestedSort: WritableAtom<
    OverviewSort | undefined,
    [OverviewSort | undefined],
    void
  >
  /**
   * The options the editor picked of the filters of the overview, by filter
   * key. The page lists the ones that apply to its overview.
   */
  requestedFilters: PrimitiveAtom<OverviewFilterSelection>
  selectedLocale: WritableAtom<
    string | null,
    [SetStateAction<string | null>],
    void
  >
  root: Atom<ExplorerRootData>
  itemsReady: (locale: string | null) => Atom<Promise<Array<ExplorerEntry>>>
  items: (locale: string | null) => Atom<Array<ExplorerEntry>>
  pageReady: Atom<Promise<ExplorerReadyPage>>
  page: Atom<ExplorerReadyPage | undefined>
  /**
   * The scroll offset of the results of a page by its `explorerScrollKey`,
   * restored when a page with the same key is shown again
   */
  scrollOffset: (key: string) => PrimitiveAtom<number>
  #options: ExplorerOptions
  /** The entry a location lists the children of, loaded with its parents */
  #parent = dispense((parentId: string, locale: string | null) =>
    atom(async (get): Promise<ExplorerParent | undefined> => {
      async function summary(id: string) {
        try {
          return await get(treeEntryAtoms(id).summary(locale))
        } catch (error) {
          if (error instanceof MissingEntryError) return undefined
          throw error
        }
      }
      const entry = await summary(parentId)
      if (!entry) return undefined
      const parents = await Promise.all(entry.parents.map(summary))
      return {
        id: entry.id,
        title: entry.title,
        parents: entry.parents,
        path: parents.flatMap(parent =>
          parent ? [{id: parent.id, title: parent.title}] : []
        )
      }
    })
  )

  constructor(
    public readonly location: WritableAtom<
      ExplorerLocation,
      [SetStateAction<ExplorerLocation>],
      void
    >,
    options: ExplorerOptions,
    initialLocation: ExplorerLocation
  ) {
    this.#options = options
    this.allowAllWorkspaces = options.allowAllWorkspaces ?? false
    const initialSearchScope = this.allowAllWorkspaces
      ? (options.initialSearchScope ?? 'workspace')
      : 'workspace'
    const initialResultMode =
      options.initialResultMode ??
      (options.condition || options.pickChildren ? 'matches' : 'browse')
    this.searchScope = atom(initialSearchScope)
    this.#selectedResultMode = atom(initialResultMode)
    this.resultMode = atom(
      get =>
        get(this.search).trim()
          ? ('matches' as const)
          : get(this.#selectedResultMode),
      (_get, set, resultMode: ExplorerResultMode) =>
        set(this.#selectedResultMode, resultMode)
    )
    this.#selectedView = atom(options.initialView)
    this.scrollOffset =
      options.scrollOffset ?? dispense((_key: string) => atom(0))
    this.requestedSort =
      options.sortState ?? atom<OverviewSort | undefined>(undefined)
    this.requestedFilters =
      options.filterState ?? atom<OverviewFilterSelection>({})
    this.mode = options.mode ?? 'browse'
    this.hasRowAction =
      options.onAction !== undefined ||
      (options.enableNavigation === true && options.onConfirm === undefined)
    this.rootScope = this.mode === 'search' ? 'workspace' : 'current'
    this.selectionMode = options.selectionMode ?? 'single'
    this.selectionBehavior = options.selectionBehavior ?? 'replace'
    this.showSelectionControls =
      options.showSelectionControls ?? this.mode !== 'search'
    this.breadcrumbs = options.breadcrumbs ?? false
    this.autoSelectFirstItem =
      options.autoSelectFirstItem ?? this.mode === 'search'
    this.hasSelection = this.selectionMode !== 'none'
    this.searchDepth =
      options.searchDepth ?? (this.mode === 'search' ? 'all' : 'current')
    this.linkedKeys = new Set<Key>(options.initialSelection)
    this.supportsInlineExpansion = options.nestedNavigation ?? false
    this.pickChildren = options.pickChildren ?? false
    this.hasCondition = Boolean(options.condition)
    this.canSearchEverything = atom(
      get =>
        this.allowAllWorkspaces &&
        (this.mode === 'search' ||
          this.hasCondition ||
          Boolean(get(this.search).trim()))
    )
    this.searchesEverything = atom(
      get =>
        get(this.canSearchEverything) &&
        get(this.resultMode) === 'matches' &&
        get(this.searchScope) === 'everything'
    )
    this.selection = atom<'all' | Set<Key>>(
      new Set<Key>((options.preselect ?? true) ? options.initialSelection : [])
    )
    this.selectedLocale =
      options.selectedLocaleAtom ??
      atom(initialLocation.locale ?? options.selectedLocale ?? null)
    if (options.rootData) {
      const rootData = options.rootData
      const value = {
        icon: atom(get => get(rootData).icon ?? LucideFile),
        label: atom(get => get(rootData).label)
      }
      this.root = atom(value)
    } else {
      this.root = atom({icon: atom(LucideFile), label: atom('')})
    }
    const itemsSource = dispense((locale: string | null) =>
      atom(async get => {
        const values = await get(this.#itemData(locale))
        return values.map(value => {
          const parentEntries = value.parentEntries ?? []
          const parentItems = parentEntries.map((parent, index) => {
            const parentValue: ExplorerItemData = {
              ...parent,
              path: '',
              parents: parentEntries.slice(0, index).map(item => item.id),
              index: '',
              data: {},
              hasChildren: true
            }
            return new ExplorerEntry(
              parent.id,
              parentValue,
              atom(parentValue),
              this.root
            )
          })
          return new ExplorerEntry(
            value.id,
            value,
            atom(value),
            this.root,
            parentItems
          )
        })
      })
    )
    this.items = dispense((locale: string | null) =>
      unwrap(itemsSource(locale), previous => previous ?? [])
    )
    this.itemsReady = dispense((locale: string | null) =>
      atom(async get => {
        get(this.items(locale))
        const items = await get(itemsSource(locale))
        if (!this.supportsInlineExpansion) return items
        const expandedKeys = get(this.expandedKeys)
        const preloadExpanded = async (entries: Array<ExplorerEntry>) => {
          await Promise.all(
            entries.map(async entry => {
              if (!expandedKeys.has(entry.id)) return
              get(this.children(entry, locale))
              const children = await get(this.childrenReady(entry, locale))
              await preloadExpanded(children)
            })
          )
        }
        await preloadExpanded(items)
        return items
      })
    )
    this.pageReady = atom(async get => {
      const locale = get(this.selectedLocale)
      const location = get(this.location)
      const search = get(this.search)
      const resultMode = get(this.resultMode)
      const searchScope = get(this.searchScope)
      const searchesEverything = get(this.searchesEverything)
      const isMedia = get(this.isMedia)
      const requestedFilters = get(this.requestedFilters)
      const requestedRoot = get(this.root)
      const root = {
        icon: atom(get(requestedRoot.icon)),
        label: atom(get(requestedRoot.label))
      }
      const itemsPromise = get(this.itemsReady(locale))
      const parentPromise = location.parentId
        ? get(this.#parent(location.parentId, locale))
        : undefined
      const overview = await get(this.overview)
      const view =
        get(this.#selectedView) ??
        (overview.layout === 'cards'
          ? 'card'
          : overview.layout === 'table'
            ? 'row'
            : get(this.view))
      // Pickers browsing cards show the tree of the root next to them
      const needsTree =
        view === 'card' &&
        resultMode === 'browse' &&
        !searchesEverything &&
        !this.pickChildren &&
        !options.limitLocations?.length
      const treeReady = needsTree
        ? options.treeReady?.(locale, location)
        : undefined
      if (treeReady) await get(treeReady)
      const parent = await parentPromise
      const canUpload = get(policyAtom).canUpload(
        uploadResource(location, parent)
      )
      const items = await itemsPromise
      // The columns follow the loaded rows, every child of the parent or
      // the search results: their types, and built-in columns that differ
      const shown = resolveOverview(
        get(configAtom),
        await get(get(this.#overviewParent)),
        {
          children: summarizeRows(
            items.map(item => get(get(item.data).data.item))
          )
        }
      )
      const requested = get(this.requestedSort)
      const sorted = search.trim() ? undefined : pickedSort(shown, requested)
      const filters = pickedFilters(shown, requestedFilters)
      const filtered = Object.keys(filters).length > 0
      return {
        canUpload,
        filters,
        isMedia,
        items,
        locale,
        location,
        parent,
        overview: shown,
        query: (await get(this.#query(locale))) ?? {
          workspace: location.workspace,
          root: location.root
        },
        resultMode,
        root,
        search,
        searchScope,
        searchesEverything,
        sort: {
          requested: sorted ? requested : undefined,
          label: sorted?.label,
          column: search.trim() ? undefined : sortedColumn(shown, requested),
          // Entries can not be reordered between hidden ones
          manual: !search.trim() && !sorted && !shown.sort && !filtered
        },
        view
      }
    })
    this.page = unwrap(this.pageReady, previous => previous)
  }

  isMedia = atom(get =>
    Boolean(this.#options.rootData && get(this.#options.rootData).isMediaRoot)
  )
  view = atom(
    get => get(this.#selectedView) ?? (get(this.isMedia) ? 'card' : 'row'),
    (_get, set, view: ExplorerView) => set(this.#selectedView, view)
  )
  /** The parent of the listed children, undefined for search results */
  #listedParent = atom(get => {
    const location = get(this.location)
    const scoped = !get(this.searchesEverything) && this.rootScope === 'current'
    if (!scoped || get(this.resultMode) === 'matches') return undefined
    return this.#parentAt(
      location.workspace,
      location.root,
      location.parentId ?? null
    )
  })
  /**
   * Where the overview of the list is configured: the parent of the listed
   * children, or the location searched in
   */
  #overviewParent = atom(get => {
    const listed = get(this.#listedParent)
    if (listed) return listed
    const location = get(this.location)
    const scoped = !get(this.searchesEverything) && this.rootScope === 'current'
    return scoped
      ? this.#parentAt(
          location.workspace,
          location.root,
          location.parentId ?? null
        )
      : this.#parentAt(location.workspace, undefined, null)
  })
  /**
   * The overview the list is loaded with: its columns, the values they
   * query and the order. The page shows the columns that tell the loaded
   * rows apart, see `pageReady`.
   */
  overview = atom(async get => {
    const parent = await get(get(this.#overviewParent))
    return resolveOverview(get(configAtom), parent, {
      mixed: !get(this.#listedParent)
    })
  })
  #parentAt = dispense(
    (workspace: string, root: string | undefined, parentId: string | null) =>
      atom(get =>
        loadOverviewParent(get(configAtom), get(graphAtom), {
          workspace,
          root,
          parentId
        })
      )
  )
  /**
   * Picks an option of a filter, or unpicks it when picked. Options of
   * filters that allow one replace the picked option.
   */
  toggleFilter = atom(
    null,
    (get, set, filter: OverviewFilterState, option: string) => {
      const {[filter.key]: current = [], ...others} = get(this.requestedFilters)
      const picked = current.includes(option)
        ? current.filter(key => key !== option)
        : filter.multiple
          ? [...current, option]
          : [option]
      set(
        this.requestedFilters,
        picked.length > 0 ? {...others, [filter.key]: picked} : others
      )
    }
  )
  /** Unpicks the options of every filter */
  clearFilters = atom(null, (_get, set) => {
    set(this.requestedFilters, {})
  })
  get limitLocations() {
    return this.#options.limitLocations
  }
  uploadsInCurrentFolder = atom(get => {
    const location = get(this.location)
    return get(activityAtom).items.filter(activity => {
      if (
        activity.type !== 'upload' ||
        activity.status !== 'running' ||
        !activity.upload
      )
        return false
      return (
        activity.upload.workspace === location.workspace &&
        activity.upload.root === location.root &&
        (activity.upload.parentId ?? null) === (location.parentId ?? null)
      )
    })
  })
  upload = atom(
    null,
    async (get, set, files: Iterable<File> | ArrayLike<File>) => {
      const location = get(this.location)
      if (!location.root) return
      const locale = get(this.selectedLocale)
      const parent = location.parentId
        ? await get(this.#parent(location.parentId, locale))
        : undefined
      const resource = uploadResource(location, parent)
      get(policyAtom).assert(Permission.Upload, resource)
      const ids = await set(requestUploadsAtom, {
        files,
        destination: {
          workspace: location.workspace,
          root: location.root,
          parentId: location.parentId,
          parents: resource.parents
        }
      })
      // Pickers select the files that were uploaded or picked instead
      if (ids.length === 0 || !this.#options.onConfirm) return
      if (this.selectionMode === 'single') {
        set(this.selection, new Set([ids[0]]))
        return
      }
      if (this.selectionMode !== 'multiple') return
      const selected = get(this.selection)
      set(
        this.selection,
        new Set([...(selected === 'all' ? [] : selected), ...ids])
      )
    }
  )
  getDragData = atom(
    null,
    (_get, _set, keys: ReadonlySet<Key>): Array<Record<string, string>> => {
      return [...keys].map(dashboardEntryDragItem)
    }
  )
  /** Entries can be dropped on a listed entry that holds children */
  canDrop = atom(
    null,
    (
      get,
      _set,
      target: DropTarget,
      types: DragTypes,
      locale: string | null
    ) => {
      if (target.position !== 'on' || !acceptsDashboardEntryDrag(types))
        return false
      const expandedKeys = get(this.expandedKeys)
      const find = (
        entries: Array<ExplorerEntry>
      ): ExplorerEntry | undefined => {
        for (const entry of entries) {
          if (entry.id === String(target.key)) return entry
          if (!expandedKeys.has(entry.id)) continue
          const child = find(get(this.children(entry, locale)))
          if (child) return child
        }
      }
      const entry = find(get(this.items(locale)))
      if (!entry) return false
      const {data} = get(entry.data)
      const type = get(configAtom).schema[get(data.item).type]
      return Boolean(type && Type.isContainer(type))
    }
  )
  /** Moves entries into the target entry */
  moveInto = atom(
    null,
    async (get, _set, ids: Iterable<string>, target: DropTarget) => {
      const graph = get(graphAtom)
      for (const id of ids) {
        if (id === String(target.key)) continue
        await graph.move({
          id,
          target: String(target.key),
          targetType: 'entry',
          dropPosition: 'on'
        })
      }
    }
  )
  /**
   * Moves entries before or after the target, in the order they are listed
   */
  reorder = atom(
    null,
    async (
      get,
      _set,
      ids: Iterable<string>,
      target: DropTarget,
      locale: string | null
    ) => {
      if (target.position === 'on') return
      const listed = get(this.items(locale)).map(entry => entry.id)
      const moving = [...ids]
        .filter(id => id !== String(target.key))
        .sort((a, b) => listed.indexOf(a) - listed.indexOf(b))
      await moveEntries(get(graphAtom), moving, target)
    }
  )
  onAction = atom(
    null,
    (get, set, entry: ExplorerEntry, locale: string | null) => {
      if (this.#options.onAction) {
        this.#options.onAction(entry)
        return
      }
      const {data} = get(entry.data)
      if (data) {
        const item = get(data.item)
        if (item.type === 'MediaLibrary') {
          set(this.openLocation, entry)
          return
        }
      }
      if (this.hasRowAction) {
        set(routeAtom, {
          workspace: entry.workspace,
          root: entry.root,
          entry: entry.id,
          locale: locale ?? undefined
        })
        return
      }
      if (data && get(data.canOpen)) set(this.openLocation, entry)
    }
  )
  openLocation = atom(null, (_get, set, entry: ExplorerEntry) => {
    set(this.selectedLocale, entry.locale)
    set(this.location, {
      workspace: entry.workspace,
      root: entry.root,
      parentId: entry.id,
      locale: entry.locale ?? undefined
    })
  })
  onConfirm = atom(null, (get, _set, locale?: string | null) => {
    const selected = get(this.selection)
    if (selected !== 'all')
      this.#options.onConfirm?.(
        [...selected].map(String),
        locale === undefined ? get(this.selectedLocale) : locale
      )
  })
  /** The listed entries that are selected, and what can be done with them */
  selectionActions = atom((get): ExplorerSelectionActions => {
    const page = get(this.page)
    const selection = get(this.selection)
    const expandedKeys = get(this.expandedKeys)
    // Rows expanded inline list their children below them
    const listed = (entries: Array<ExplorerEntry>): Array<ExplorerEntry> =>
      entries.flatMap(entry =>
        this.supportsInlineExpansion &&
        page?.resultMode === 'browse' &&
        expandedKeys.has(entry.id)
          ? [entry, ...listed(get(this.children(entry, page.locale)))]
          : [entry]
      )
    const items = listed(page?.items ?? [])
      .filter(entry => selection === 'all' || selection.has(entry.id))
      .flatMap(entry => {
        const {data} = get(entry.data)
        return data ? [get(data.item)] : []
      })
    const policy = get(policyAtom)
    const allowed = items.filter(item => explorerItemCanMove(policy, item))
    const [first] = allowed
    // Entries move within their root, search results can span roots
    const oneRoot = allowed.every(
      item => item.workspace === first.workspace && item.root === first.root
    )
    return {
      items,
      movable: oneRoot ? allowed : [],
      deletable: items.filter(item => explorerItemCanDelete(policy, item))
    }
  })
  clearSelection = atom(null, (_get, set) => set(this.selection, new Set()))
  isExpanded = dispense((entry: ExplorerEntry) =>
    atom(get => get(this.expandedKeys).has(entry.id))
  )
  isSelectable = dispense((entry: ExplorerEntry) =>
    atom(get => {
      const {canSelect, condition} = this.#options
      if (!condition && !canSelect) return true
      const {data} = get(entry.data)
      if (!data) return false
      const item = get(data.item)
      if (canSelect && !canSelect(item)) return false
      if (!condition) return true
      return filterChecker(condition, (candidate, name) =>
        explorerItemField(candidate as ExplorerItemData, name)
      )(item as never)
    })
  )
  childrenReady = dispense((entry: ExplorerEntry, locale: string | null) =>
    atom(async get => {
      get(shaAtom)
      const {data} = get(entry.data)
      if (!data || !get(data.hasChildren)) return []
      const config = get(configAtom)
      const graph = get(graphAtom)
      const requestedFilters = get(this.requestedFilters)
      const overview = await get(this.overview)
      const entries = await graph.find({
        workspace: entry.workspace,
        root: entry.root,
        parentId: entry.id,
        locale,
        filter: overviewFilter(overview, requestedFilters),
        status: 'preferDraft',
        groupBy: Entry.id,
        orderBy: overviewOrder(overview, get(this.requestedSort)),
        select: explorerItemSelect
      })
      const policy = get(policyAtom)
      const readable = entries.filter(candidate => policy.canRead(candidate))
      const [parentIds, rows] = await Promise.all([
        parentsWithChildren(
          graph,
          entry.workspace,
          entry.root,
          readable.map(candidate => candidate.id)
        ),
        loadColumnValues(config, graph, overview, readable)
      ])
      const currentParents = get(data.parents)
      const values = await withLinkedEntries(
        get,
        overview,
        rows.map(candidate => ({
          ...candidate,
          hasChildren: parentIds.has(candidate.id)
        }))
      )
      return values.map(value => {
        return new ExplorerEntry(value.id, value, atom(value), this.root, [
          ...currentParents,
          entry
        ])
      })
    })
  )
  children = dispense((entry: ExplorerEntry, locale: string | null) =>
    unwrap(this.childrenReady(entry, locale), previous => previous ?? [])
  )
  /** The query of the listed entries, undefined when nothing is listed */
  #query = dispense((locale: string | null) =>
    atom(async (get): Promise<ExplorerQuery | undefined> => {
      const location = get(this.location)
      const search = get(this.search).trim()
      const searchesEverything = get(this.searchesEverything)
      const searchesMultipleRoots =
        searchesEverything || this.rootScope === 'workspace'
      const resultMode = get(this.resultMode)
      if (!searchesEverything && !location.root && this.rootScope === 'current')
        return undefined
      if (this.mode === 'search' && !search) return undefined
      const requestedFilters = get(this.requestedFilters)
      const overview = await get(this.overview)
      const flatList = resultMode === 'matches'
      const condition = flatList ? this.#options.condition : undefined
      const picked = overviewFilter(overview, requestedFilters)
      // Searching all locations stays within the locations a picker allows
      const limits = this.#options.limitLocations
      const allowed =
        searchesEverything && limits?.length
          ? {
              or: limits.map(limit => ({
                _workspace: limit.workspace,
                _root: limit.root
              }))
            }
          : undefined
      // The search terms, the picker's condition and the picked filters apply
      const filters = [condition, picked, allowed].filter(
        filter => filter !== undefined
      )
      const filter = filters.length > 1 ? {and: filters} : filters[0]
      return {
        workspace: searchesEverything ? undefined : location.workspace,
        root:
          searchesEverything || this.rootScope === 'workspace'
            ? undefined
            : location.root,
        parentId: this.pickChildren
          ? (location.parentId ?? null)
          : flatList
            ? undefined
            : searchesEverything
              ? null
              : (location.parentId ?? null),
        locale: searchesMultipleRoots ? undefined : locale,
        search: search || undefined,
        filter,
        status: 'preferDraft',
        orderBy: search
          ? undefined
          : overviewOrder(overview, get(this.requestedSort))
      }
    })
  )
  #itemData = dispense((locale: string | null) =>
    atom(async get => {
      get(shaAtom)
      const query = await get(this.#query(locale))
      if (!query) return []
      const location = get(this.location)
      const search = get(this.search).trim()
      const searchesEverything = get(this.searchesEverything)
      const flatList = get(this.resultMode) === 'matches'
      const config = get(configAtom)
      const graph = get(graphAtom)
      const overview = await get(this.overview)
      const selectedLocationParentId =
        this.searchDepth === 'current' &&
        !searchesEverything &&
        flatList &&
        !this.pickChildren &&
        location.root &&
        location.parentId
          ? location.parentId
          : undefined
      const entries = await graph.find({
        ...query,
        // Search results arrive ranked; loading every match with its data
        // costs seconds on large sites while only the best ones are shown.
        take: search ? searchResultLimit : undefined,
        groupBy: Entry.id,
        select: explorerItemSelect
      })
      const policy = get(policyAtom)
      const condition = this.#options.condition
      const matchesCondition = condition
        ? filterChecker(condition, (candidate, name) =>
            explorerItemField(candidate as ExplorerItemData, name)
          )
        : undefined
      const readable = entries.filter(
        entry =>
          policy.canRead(entry) &&
          (!selectedLocationParentId ||
            entry.parents.includes(selectedLocationParentId)) &&
          (!flatList || !matchesCondition || matchesCondition(entry as never))
      )
      const [parentIds, rows] = await Promise.all([
        parentsWithChildren(
          graph,
          query.workspace,
          query.root,
          readable.map(entry => entry.id)
        ),
        loadColumnValues(config, graph, overview, readable)
      ])
      return withLinkedEntries(
        get,
        overview,
        rows.map(entry => ({
          ...entry,
          hasChildren: parentIds.has(entry.id)
        }))
      )
    })
  )
}

/**
 * The ids of the given entries that have children. Queried in chunks: SQLite
 * fails on a list of about ten thousand bound values.
 */
async function parentsWithChildren(
  graph: Graph,
  workspace: GraphQuery['workspace'],
  root: GraphQuery['root'],
  ids: Array<string>
): Promise<Set<string>> {
  const found = await Promise.all(
    Array.from(chunks(ids, 1000), chunk =>
      graph.find({
        workspace,
        root,
        parentId: {in: chunk},
        status: 'preferDraft',
        groupBy: Entry.parentId,
        select: Entry.parentId
      })
    )
  )
  return new Set(found.flat().filter(id => id !== null))
}

const explorerItemSelect = {
  active: Entry.active,
  createdAt: Entry.createdAt,
  id: Entry.id,
  status: Entry.status,
  main: Entry.main,
  title: Entry.title,
  path: Entry.path,
  updatedAt: Entry.updatedAt,
  url: Entry.url,
  type: Entry.type,
  workspace: Entry.workspace,
  root: Entry.root,
  locale: Entry.locale,
  parentId: Entry.parentId,
  parents: Entry.parents,
  seeded: Entry.seeded,
  parentEntries: parents({
    select: {
      id: Entry.id,
      title: Entry.title,
      type: Entry.type,
      workspace: Entry.workspace,
      root: Entry.root,
      locale: Entry.locale,
      parentId: Entry.parentId
    }
  }),
  index: Entry.index,
  data: Entry.data
}

export function createExplorerAtoms(
  initialLocation: ExplorerLocation,
  options: ExplorerOptions
): ExplorerAtoms {
  const initial = constrainLocation(initialLocation, options.limitLocations)
  const locationState = atom(initial)
  const location = atom(
    get => get(locationState),
    (get, set, update: SetStateAction<ExplorerLocation>) => {
      const current = get(locationState)
      const next = typeof update === 'function' ? update(current) : update
      set(locationState, constrainLocation(next, options.limitLocations))
    }
  )
  return new ExplorerAtoms(location, options, initial)
}

export type DashboardEntry = ExplorerEntry
export type DashboardEntryData = ExplorerEntryData
export type DashboardExplorer = ExplorerAtoms
export type DashboardRoot = ExplorerRootData
