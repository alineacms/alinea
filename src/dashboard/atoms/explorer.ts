import {Entry, type EntryStatus} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import {filterChecker} from '#/core/db/EntryResolver.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import type {Filter} from '#/core/Filter.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import type {OrderBy} from '#/core/OrderBy.js'
import {Permission} from '#/core/Role.js'
import type {RootData} from '#/core/Root.js'
import {Type} from '#/core/Type.js'
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
import type {
  DragItem,
  DragTypes,
  DropOperation,
  DropTarget
} from '@react-types/shared'
import type {
  DroppableCollectionOnItemDropEvent,
  Key
} from 'react-aria-components'
import {LucideFile} from '../icons.js'
import {dashboardAtoms} from './dashboard.js'
import {configAtom, graphAtom} from './core.js'
import {shaAtom} from './graph.js'
import {routeAtom} from './nav.js'
import {uploadFilesAtom} from './upload.js'
import {policyAtom} from './user.js'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDragItem,
  dashboardEntryDragTypes,
  dispense
} from './utils.js'

export const dashboardEntryOverviewColumnCount = 5

export type ExplorerView = 'card' | 'row'
export type ExplorerSortBy = 'title' | 'path' | 'size' | 'id' | 'index'
export type ExplorerSortDirections = 'asc' | 'desc'
export interface ExplorerSort {
  sortBy: ExplorerSortBy
  direction: ExplorerSortDirections
}
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
  defaultOrderBy?: Atom<OrderBy | Array<OrderBy> | undefined>
  enableNavigation?: boolean
  hideResultsUntilSearch?: boolean
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
  selectedLocale?: string | null
  selectionMode?: 'none' | 'single' | 'multiple'
  selectionBehavior?: 'toggle' | 'replace'
  showSelectionControls?: boolean
  initialSelection?: Array<string>
  searchDepth?: 'current' | 'all'
  onAction?: (entry: ExplorerEntry) => void
  onConfirm?: (selection: Array<string>) => void
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

export interface ExplorerReadyPage {
  isMedia: boolean
  items: Array<ExplorerEntry>
  locale: string | null
  location: ExplorerLocation
  root: ExplorerRootData
  resultMode: ExplorerResultMode
  searchScope: 'workspace' | 'everything'
  searchesEverything: boolean
  view: ExplorerView
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
}

function explorerItemField(item: ExplorerItemData, name: string) {
  if (!name.startsWith('_')) return item.data[name]
  const entry = item as unknown as Record<string, unknown>
  return entry[name.slice(1)]
}

export interface DashboardEntryOverviewCell {
  id: string
  field: Field
  label: string
  value: unknown
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
  overviewCells = atom((get): Array<DashboardEntryOverviewCell> => {
    const item = get(this.item)
    const type = get(configAtom).schema[item.type]
    if (!type) return []
    return Object.entries(Type.fields(type))
      .flatMap(([key, field]) => {
        const options = Field.options(field) as FieldOptions<unknown>
        if (options.hidden || options.overview !== true || key === 'title')
          return []
        return [
          {id: key, field, label: Field.label(field), value: item.data[key]}
        ]
      })
      .slice(0, dashboardEntryOverviewColumnCount)
  })

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

export class ExplorerAtoms {
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
  readonly hideResultsUntilSearch
  readonly linkedKeys: ReadonlySet<Key>
  readonly searchDepth
  readonly supportsInlineExpansion
  readonly pickChildren
  readonly hasCondition
  readonly canSearchEverything: Atom<boolean>
  readonly searchesEverything: Atom<boolean>
  readonly readySearchesEverything: Atom<boolean>
  readonly readySearchScope: Atom<'workspace' | 'everything'>
  readonly readyResultMode: Atom<ExplorerResultMode>
  readonly readyView: Atom<ExplorerView>
  readonly locationIsPending: Atom<boolean>

  search = atom('')
  searchScope: PrimitiveAtom<'workspace' | 'everything'>
  resultMode: WritableAtom<ExplorerResultMode, [ExplorerResultMode], void>
  selection: PrimitiveAtom<'all' | Set<Key>>
  expandedKeys = atom(new Set<Key>())
  #selectedResultMode: PrimitiveAtom<ExplorerResultMode>
  #selectedView: PrimitiveAtom<ExplorerView | undefined>
  #selectedSort = atom<ExplorerSort>()
  #selectedFilter = atom<ExplorerTypeFilters>()
  selectedLocale: PrimitiveAtom<string | null>
  root: Atom<ExplorerRootData>
  parent: (
    location: ExplorerLocation,
    locale: string | null
  ) => Atom<ExplorerEntry | undefined>
  itemsReady: (locale: string | null) => Atom<Promise<Array<ExplorerEntry>>>
  items: (locale: string | null) => Atom<Array<ExplorerEntry>>
  page: Atom<ExplorerReadyPage>
  #options: ExplorerOptions

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
    this.hideResultsUntilSearch =
      options.hideResultsUntilSearch ?? this.mode === 'search'
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
    this.selectedLocale = atom(
      initialLocation.locale ?? options.selectedLocale ?? null
    )
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
    const initialView = options.initialView ?? 'row'
    const pageSource = atom(async get => {
      const locale = get(this.selectedLocale)
      const location = get(this.location)
      const resultMode = get(this.resultMode)
      const searchScope = get(this.searchScope)
      const searchesEverything = get(this.searchesEverything)
      const view = get(this.view)
      const isMedia = get(this.isMedia)
      const requestedRoot = get(this.root)
      const root = {
        icon: atom(get(requestedRoot.icon)),
        label: atom(get(requestedRoot.label))
      }
      const itemsPromise = get(this.itemsReady(locale))
      const needsTree = view === 'card' && resultMode === 'browse'
      const treeReady = needsTree
        ? options.treeReady?.(locale, location)
        : undefined
      if (treeReady) await get(treeReady)
      const items = await itemsPromise
      return {
        isMedia,
        items,
        locale,
        location,
        resultMode,
        root,
        searchScope,
        searchesEverything,
        view
      }
    })
    this.page = unwrap(
      pageSource,
      previous =>
        previous ?? {
          isMedia: false,
          items: [],
          locale: initialLocation.locale ?? options.selectedLocale ?? null,
          location: initialLocation,
          resultMode: initialResultMode,
          root: {icon: atom(LucideFile), label: atom('')},
          searchScope: initialSearchScope,
          searchesEverything:
            this.allowAllWorkspaces &&
            this.hasCondition &&
            initialResultMode === 'matches' &&
            initialSearchScope === 'everything',
          view: initialView
        }
    )
    const readyPage = (get: Getter) => get(this.page)
    this.readySearchScope = atom(get => readyPage(get).searchScope)
    this.readyResultMode = atom(get => readyPage(get).resultMode)
    this.readySearchesEverything = atom(
      get => readyPage(get).searchesEverything
    )
    this.readyView = atom(get => readyPage(get).view)
    this.locationIsPending = atom(get => {
      const ready = readyPage(get)
      const requested = get(this.location)
      return (
        ready.locale !== get(this.selectedLocale) ||
        ready.location.workspace !== requested.workspace ||
        ready.location.root !== requested.root ||
        ready.location.parentId !== requested.parentId
      )
    })
  }

  showResults = atom(get => {
    return !this.hideResultsUntilSearch || Boolean(get(this.search).trim())
  })
  isMedia = atom(get =>
    Boolean(this.#options.rootData && get(this.#options.rootData).isMediaRoot)
  )
  view = atom(
    get => get(this.#selectedView) ?? (get(this.isMedia) ? 'card' : 'row'),
    (_get, set, view: ExplorerView) => set(this.#selectedView, view)
  )
  sort = atom(
    (get): ExplorerSort =>
      get(this.#selectedSort) ?? {
        sortBy: get(this.isMedia) ? 'title' : 'index',
        direction: 'asc'
      },
    (get, set, sortBy: ExplorerSortBy) => {
      const current = get(this.sort)
      set(this.#selectedSort, {
        sortBy,
        direction:
          current.sortBy === sortBy && current.direction === 'desc'
            ? 'asc'
            : 'desc'
      })
    }
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
  canUpload = atom(get => {
    const location = get(this.location)
    return get(policyAtom).canUpload({
      workspace: location.workspace,
      root: location.root,
      id: location.parentId
    })
  })
  uploadsInCurrentFolder = atom(get => {
    const location = get(this.location)
    return get(dashboardAtoms.mutationQueue).entries.filter(entry => {
      if (!entry.upload) return false
      return (
        entry.upload.workspace === location.workspace &&
        entry.upload.root === location.root &&
        (entry.upload.parentId ?? null) === (location.parentId ?? null)
      )
    })
  })
  upload = atom(null, (get, set, files: Iterable<File> | ArrayLike<File>) => {
    const location = get(this.location)
    if (!location.root) return
    set(uploadFilesAtom, {
      files,
      workspace: location.workspace,
      root: location.root,
      parentId: location.parentId
    })
  })
  getItems = atom(null, (_get, _set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(dashboardEntryDragItem)
  })
  getDropOperation = atom(
    null,
    (
      _get,
      _set,
      target: DropTarget,
      types: DragTypes,
      allowedOperations: Array<DropOperation>
    ) => {
      if (target.type !== 'item' || !acceptsDashboardEntryDrag(types))
        return 'cancel'
      return allowedOperations.includes('move') ? 'move' : 'cancel'
    }
  )
  onItemDrop = atom(
    null,
    async (
      get,
      _set,
      event: DroppableCollectionOnItemDropEvent,
      locale: string | null
    ) => {
      const target = String(event.target.key)
      const entries = get(this.items(locale))
      const policy = get(policyAtom)
      const graph = get(graphAtom)
      for (const dragItem of event.items) {
        if (dragItem.kind !== 'text' || !dragItem.types || !dragItem.getText)
          continue
        const id = dragItem.types.has(dashboardEntryDragTypes[0])
          ? await dragItem.getText(dashboardEntryDragTypes[0])
          : await dragItem.getText('text/plain')
        const entry = entries.find(entry => entry.id === id)
        if (!entry) continue
        const {data} = get(entry.data)
        if (!data) continue
        const item = get(data.item)
        policy.assert(Permission.Move, item)
        await graph.move({
          id,
          target,
          targetType: 'entry',
          dropPosition: 'on'
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
      if (this.hasRowAction) {
        set(routeAtom, {
          workspace: entry.workspace,
          root: entry.root,
          entry: entry.id,
          locale: locale ?? undefined
        })
        return
      }
      const {data} = get(entry.data)
      if (data && get(data.hasChildren)) set(this.openLocation, entry)
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
  onConfirm = atom(null, get => {
    const selected = get(this.selection)
    if (selected !== 'all') this.#options.onConfirm?.([...selected].map(String))
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
      const graph = get(graphAtom)
      const sort = get(this.sort)
      const filter = get(this.filter)
      const entries = await graph.find({
        workspace: entry.workspace,
        root: entry.root,
        parentId: entry.id,
        locale,
        filter: undefined,
        type: filter,
        status: 'preferDraft',
        groupBy: Entry.id,
        orderBy: {
          [sort.direction]:
            sort.sortBy === 'title'
              ? Entry.title
              : sort.sortBy === 'path'
                ? Entry.path
                : sort.sortBy === 'size'
                  ? MediaFile.size
                  : sort.sortBy === 'id'
                    ? Entry.id
                    : Entry.index,
          caseSensitive: sort.sortBy !== 'id'
        },
        select: {
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
      })
      const policy = get(policyAtom)
      const readable = entries.filter(candidate => policy.canRead(candidate))
      const parentIds = await graph.find({
        workspace: entry.workspace,
        root: entry.root,
        parentId: {in: readable.map(candidate => candidate.id)},
        status: 'preferDraft',
        groupBy: Entry.parentId,
        select: Entry.parentId
      })
      const currentParents = get(data.parents)
      return readable.map(candidate => {
        const value = {
          ...candidate,
          hasChildren: parentIds.includes(candidate.id)
        }
        return new ExplorerEntry(candidate.id, value, atom(value), this.root, [
          ...currentParents,
          entry
        ])
      })
    })
  )
  children = dispense((entry: ExplorerEntry, locale: string | null) =>
    unwrap(this.childrenReady(entry, locale), previous => previous ?? [])
  )
  #itemData = dispense((locale: string | null) =>
    atom(async get => {
      get(shaAtom)
      const location = get(this.location)
      const search = get(this.search).trim()
      const searchesEverything = get(this.searchesEverything)
      const resultMode = get(this.resultMode)
      const workspace = searchesEverything ? undefined : location.workspace
      const root = searchesEverything
        ? undefined
        : this.rootScope === 'workspace'
          ? undefined
          : location.root
      if (!searchesEverything && !location.root && this.rootScope === 'current')
        return []
      if (this.hideResultsUntilSearch && !search) return []
      const graph = get(graphAtom)
      const sort = get(this.sort)
      const selectedSort = get(this.#selectedSort)
      const filter = get(this.filter)
      const defaultOrderBy = this.#options.defaultOrderBy
        ? get(this.#options.defaultOrderBy)
        : undefined
      const flatList = resultMode === 'matches'
      const selectedLocationParentId =
        !searchesEverything &&
        flatList &&
        !this.pickChildren &&
        location.root &&
        location.parentId
          ? location.parentId
          : undefined
      const orderField =
        sort.sortBy === 'title'
          ? Entry.title
          : sort.sortBy === 'path'
            ? Entry.path
            : sort.sortBy === 'size'
              ? MediaFile.size
              : sort.sortBy === 'id'
                ? Entry.id
                : Entry.index
      const entries = await graph.find({
        workspace,
        root,
        parentId: this.pickChildren
          ? (location.parentId ?? null)
          : flatList
            ? undefined
            : searchesEverything
              ? null
              : (location.parentId ?? null),
        locale: searchesEverything ? undefined : locale,
        search: search || undefined,
        filter: flatList ? this.#options.condition : undefined,
        type: filter,
        status: 'preferDraft',
        groupBy: Entry.id,
        orderBy: search
          ? undefined
          : selectedSort === undefined && defaultOrderBy !== undefined
            ? defaultOrderBy
            : {
                [sort.direction]: orderField,
                caseSensitive: sort.sortBy !== 'id'
              },
        select: {
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
      const parentIds = await graph.find({
        workspace,
        root,
        parentId: {in: readable.map(entry => entry.id)},
        status: 'preferDraft',
        groupBy: Entry.parentId,
        select: Entry.parentId
      })
      return readable.map(entry => ({
        ...entry,
        hasChildren: parentIds.includes(entry.id)
      }))
    })
  )
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
