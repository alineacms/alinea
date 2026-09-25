import type {DragTypes, DropTarget, Key} from '#/components.js'
import {Entry, type EntryStatus} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import {filterChecker} from '#/core/Filter.js'
import {Field} from '#/core/Field.js'
import type {Filter} from '#/core/Filter.js'
import type {Graph, GraphQuery} from '#/core/Graph.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import type {OverviewSort} from '#/core/Overview.js'
import {Permission, type Resource} from '#/core/Role.js'
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
import {
  columnLinkIds,
  loadColumnValues,
  loadOverviewParent,
  overviewOrder,
  type OverviewState,
  resolveOverview,
  sortColumn,
  sortedColumn,
  summarizeRows,
  thumbnailField
} from './overview.js'
import {shaAtom} from './graph.js'
import {routeAtom} from './nav.js'
import {uploadFilesAtom} from './upload.js'
import {policyAtom} from './user.js'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDragItem,
  dispense
} from './utils.js'

/** The best ranked matches a search loads into the explorer. */
export const searchResultLimit = 100

export type ExplorerView = 'card' | 'row'
export type ExplorerTypeFilters = typeof MediaFile | typeof MediaLibrary

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
  treeItems?: (
    locale: string | null,
    location: ExplorerLocation
  ) => Atom<Array<ExplorerTreeItem>>
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
  showSelectionControls?: boolean
  initialSelection?: Array<string>
  searchDepth?: 'current' | 'all'
  onAction?: (entry: ExplorerEntry) => void
  onConfirm?: (selection: Array<string>, locale: string | null) => void
  preselect?: boolean
}

export interface ExplorerTreeItem {
  id: string
  title: string
  type: string
  parentId: string | null
  hasChildren: boolean
}

export type ExplorerResultMode = 'browse' | 'matches'

type ExplorerQuery = GraphQuery<undefined, Type | undefined, undefined>

/** How the listed entries are ordered */
export interface ExplorerSortState {
  /** The column the editor sorted by */
  requested?: OverviewSort
  /** The header of the column the editor sorted by */
  label?: string
  /** The column shown as sorted, also for the parent's default order */
  column?: OverviewSort
  /** Entries are listed in their stored order and can be reordered */
  manual: boolean
}

export interface ExplorerReadyPage {
  canUpload: boolean
  isMedia: boolean
  items: Array<ExplorerEntry>
  locale: string | null
  location: ExplorerLocation
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

export interface ExplorerItemData {
  active?: boolean
  createdAt?: number | null
  id: string
  status?: EntryStatus
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
  return Field.references(field, item.data[name], {
    path: [name],
    label: Field.label(field)
  }).find(reference => reference.linkType === 'image')?.targetId
}

/**
 * Loads the thumbnails and the entries linked from the overview columns of
 * the given explorer items in a single query
 */
export async function withLinkedEntries<Item extends ExplorerItemData>(
  get: Getter,
  overview: OverviewState,
  items: Array<Item>
): Promise<Array<Item>> {
  const config = get(configAtom)
  const schema = config.schema
  const wanted = items.map(item => {
    const type = schema[item.type]
    if (!type || type === MediaFile || type === MediaLibrary)
      return {thumbnail: undefined, links: []}
    return {
      thumbnail: cardThumbnailId(get, overview, item),
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
  /** The column the editor sorted by */
  requestedSort: WritableAtom<
    OverviewSort | undefined,
    [OverviewSort | undefined],
    void
  >
  #selectedFilter = atom<ExplorerTypeFilters>()
  selectedLocale: WritableAtom<
    string | null,
    [SetStateAction<string | null>],
    void
  >
  root: Atom<ExplorerRootData>
  parent: (
    location: ExplorerLocation,
    locale: string | null
  ) => Atom<ExplorerEntry | undefined>
  itemsReady: (locale: string | null) => Atom<Promise<Array<ExplorerEntry>>>
  items: (locale: string | null) => Atom<Array<ExplorerEntry>>
  pageReady: Atom<Promise<ExplorerReadyPage>>
  page: Atom<ExplorerReadyPage | undefined>
  #options: ExplorerOptions
  #uploadResource = dispense(
    (location: ExplorerLocation, locale: string | null) =>
      atom(get => {
        const fallback: Resource = {
          workspace: location.workspace,
          root: location.root,
          id: location.parentId
        }
        if (!location.parentId) return fallback
        const parent = get(this.parent(location, locale))
        if (!parent) return fallback
        const {data} = get(parent.data)
        return {
          ...fallback,
          parents: get(data.parents).map(ancestor => ancestor.id)
        }
      })
  )
  #canUpload = dispense((location: ExplorerLocation, locale: string | null) =>
    atom(get =>
      get(policyAtom).canUpload(get(this.#uploadResource(location, locale)))
    )
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
    this.requestedSort =
      options.sortState ?? atom<OverviewSort | undefined>(undefined)
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
    const treeEntry = (item: ExplorerTreeItem): ExplorerEntry => {
      const value: ExplorerItemData = {
        id: item.id,
        title: item.title,
        path: '',
        type: item.type,
        workspace: initialLocation.workspace,
        root: initialLocation.root ?? '',
        locale: null,
        parentId: item.parentId,
        parents: [],
        index: '',
        data: {},
        hasChildren: item.hasChildren
      }
      return new ExplorerEntry(item.id, value, atom(value), this.root)
    }
    this.parent = dispense(
      (location: ExplorerLocation, locale: string | null) =>
        atom(get => {
          const parentId = location.parentId
          if (!parentId || !options.treeItems) return undefined
          const items = get(options.treeItems(locale, location))
          const item = items.find(candidate => candidate.id === parentId)
          if (!item) return undefined
          const parent = treeEntry(item)
          const ancestors = new Array<ExplorerEntry>()
          let ancestorId = item.parentId
          while (ancestorId) {
            const ancestor = items.find(
              candidate => candidate.id === ancestorId
            )
            if (!ancestor) break
            ancestors.unshift(treeEntry(ancestor))
            ancestorId = ancestor.parentId
          }
          const {data} = get(parent.data)
          if (data) data.parents = atom(ancestors)
          return parent
        })
    )
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
      const requestedRoot = get(this.root)
      const root = {
        icon: atom(get(requestedRoot.icon)),
        label: atom(get(requestedRoot.label))
      }
      const itemsPromise = get(this.itemsReady(locale))
      const overview = await get(this.overview)
      const view =
        get(this.#selectedView) ??
        (overview.layout === 'cards'
          ? 'card'
          : overview.layout === 'table'
            ? 'row'
            : get(this.view))
      const needsTree =
        Boolean(location.parentId) ||
        (view === 'card' &&
          resultMode === 'browse' &&
          !searchesEverything &&
          !this.pickChildren &&
          !options.limitLocations?.length)
      const treeReady = needsTree
        ? options.treeReady?.(locale, location)
        : undefined
      if (treeReady) await get(treeReady)
      const canUpload = get(this.#canUpload(location, locale))
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
      const sorted = search.trim() ? undefined : sortColumn(shown, requested)
      return {
        canUpload,
        isMedia,
        items,
        locale,
        location,
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
          label: sorted?.header,
          column: search.trim() ? undefined : sortedColumn(shown, requested),
          manual: !search.trim() && !sorted && !shown.sort
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
  /** Sorts by a column, or returns to the default order */
  sort = atom(null, (_get, set, sort: OverviewSort | undefined) => {
    set(this.requestedSort, sort)
  })
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
  filter = atom(
    get => get(this.#selectedFilter),
    (get, set, filter: ExplorerTypeFilters) => {
      set(
        this.#selectedFilter,
        get(this.#selectedFilter) === filter ? undefined : filter
      )
    }
  )
  get limitLocations() {
    return this.#options.limitLocations
  }
  canUpload = atom(get =>
    get(this.#canUpload(get(this.location), get(this.selectedLocale)))
  )
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
      const treeReady = this.#options.treeReady?.(locale, location)
      if (treeReady) await get(treeReady)
      const resource = get(this.#uploadResource(location, locale))
      get(policyAtom).assert(Permission.Upload, resource)
      await set(uploadFilesAtom, {
        files,
        workspace: location.workspace,
        root: location.root,
        parentId: location.parentId,
        parents: resource.parents
      })
    }
  )
  getDragData = atom(
    null,
    (_get, _set, keys: ReadonlySet<Key>): Array<Record<string, string>> => {
      return [...keys].map(dashboardEntryDragItem)
    }
  )
  /** Entries can be dropped on other entries */
  canDrop = atom(null, (_get, _set, target: DropTarget, types: DragTypes) => {
    return target.position === 'on' && acceptsDashboardEntryDrag(types)
  })
  /** Moves the dragged entries of this explorer into the target entry */
  moveInto = atom(
    null,
    async (
      get,
      _set,
      ids: Iterable<string>,
      target: DropTarget,
      locale: string | null
    ) => {
      const entries = get(this.items(locale))
      const policy = get(policyAtom)
      const graph = get(graphAtom)
      for (const id of ids) {
        const entry = entries.find(entry => entry.id === id)
        if (!entry) continue
        const {data} = get(entry.data)
        if (!data) continue
        const item = get(data.item)
        policy.assert(Permission.Move, item)
        await graph.move({
          id,
          target: String(target.key),
          targetType: 'entry',
          dropPosition: 'on'
        })
      }
    }
  )
  /** Moves the dragged entries of this explorer before or after the target */
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
      const entries = get(this.items(locale))
      const policy = get(policyAtom)
      const graph = get(graphAtom)
      for (const id of ids) {
        const entry = entries.find(entry => entry.id === id)
        if (!entry || String(target.key) === id) continue
        const {data} = get(entry.data)
        if (!data) continue
        policy.assert(Permission.Reorder, get(data.item))
        await graph.move({
          id,
          target: String(target.key),
          targetType: 'entry',
          dropPosition: target.position
        })
      }
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
  isExpanded = dispense((entry: ExplorerEntry) =>
    atom(get => get(this.expandedKeys).has(entry.id))
  )
  isSelectable = dispense((entry: ExplorerEntry) =>
    atom(get => {
      if (!this.#options.condition) return true
      const {data} = get(entry.data)
      if (!data) return false
      const item = get(data.item)
      return filterChecker(this.#options.condition, (candidate, name) =>
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
      const filter = get(this.filter)
      const overview = await get(this.overview)
      const entries = await graph.find({
        workspace: entry.workspace,
        root: entry.root,
        parentId: entry.id,
        locale,
        filter: undefined,
        type: filter,
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
      const overview = await get(this.overview)
      const flatList = resultMode === 'matches'
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
        filter: flatList ? this.#options.condition : undefined,
        type: get(this.filter),
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
