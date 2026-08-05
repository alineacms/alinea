import {Entry} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import type {Filter} from '#/core/Filter.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import type {RootData} from '#/core/Root.js'
import type {Policy} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import type {Infer} from '#/types.js'
import {parents} from '#/query.js'
import {atom, type Atom, type Getter, type PrimitiveAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {ComponentType} from 'react'
import type {Key} from 'react-aria-components'
import {LucideFile} from '../icons.js'
import {dashboardAtoms} from './dashboard.js'
import {configAtom, graphAtom} from './core.js'
import {shaAtom} from './graph.js'
import {routeAtom} from './nav.js'
import {uploadFilesAtom} from './upload.js'

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
}

export interface ExplorerOptions {
  autoSelectFirstItem?: boolean
  breadcrumbs?: boolean
  condition?: Filter<EntryFields>
  enableNavigation?: boolean
  flatResults?: boolean
  hideResultsUntilSearch?: boolean
  location?: ExplorerLocation
  mode?: 'browse' | 'search'
  pickChildren?: boolean
  rootData?: Atom<RootData>
  treeItems?: Atom<Array<ExplorerTreeItem>>
  selectedLocale?: string | null
  selectionMode?: 'none' | 'single' | 'multiple'
  selectionBehavior?: 'toggle' | 'replace'
  showSelectionControls?: boolean
  initialSelection?: Array<string>
  searchDepth?: 'current' | 'all'
  onAction?: (entry: ExplorerEntry) => void
  onConfirm?: (selection: Array<string>) => void
  policy: Policy
}

export interface ExplorerTreeItem {
  id: string
  title: string
  type: string
  parentId: string | null
  hasChildren: boolean
}

export interface ExplorerItemData {
  id: string
  title: string
  path: string
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
    root: Atom<ExplorerRootData>,
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
      return data?.icon ?? get(get(root).icon)
    })
    const label = atom(get => {
      const data = configuredRoot(get)
      return data?.label ?? get(get(root).label)
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
  readonly searchDepth

  search = atom('')
  selection: PrimitiveAtom<'all' | Set<Key>>
  #selectedView = atom<ExplorerView>()
  #selectedSort = atom<ExplorerSort>()
  #selectedFilter = atom<ExplorerTypeFilters>()
  selectedLocale: PrimitiveAtom<string | null>
  root: Atom<ExplorerRootData>
  parent: Atom<ExplorerEntry | undefined>
  itemsReady: Atom<Promise<Array<ExplorerEntry>>>
  items: Atom<Array<ExplorerEntry>>

  constructor(
    public readonly location: PrimitiveAtom<ExplorerLocation>,
    private readonly options: ExplorerOptions,
    initialLocation: ExplorerLocation
  ) {
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
    this.selection = atom<'all' | Set<Key>>(
      new Set<Key>(options.initialSelection)
    )
    this.selectedLocale = atom(options.selectedLocale ?? null)
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
    this.parent = atom(get => {
      const parentId = get(this.location).parentId
      if (!parentId || !options.treeItems) return undefined
      const items = get(options.treeItems)
      const item = items.find(candidate => candidate.id === parentId)
      if (!item) return undefined
      const parent = treeEntry(item)
      const ancestors = new Array<ExplorerEntry>()
      let ancestorId = item.parentId
      while (ancestorId) {
        const ancestor = items.find(candidate => candidate.id === ancestorId)
        if (!ancestor) break
        ancestors.unshift(treeEntry(ancestor))
        ancestorId = ancestor.parentId
      }
      const {data} = get(parent.data)
      if (data) data.parents = atom(ancestors)
      return parent
    })
    this.itemsReady = atom(async get => {
      const values = await get(this.itemData)
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
    this.items = unwrap(this.itemsReady, previous => previous ?? [])
  }

  showResults = atom(get => {
    return !this.hideResultsUntilSearch || Boolean(get(this.search).trim())
  })
  isMedia = atom(get =>
    Boolean(this.options.rootData && get(this.options.rootData).isMediaRoot)
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
  canUpload = atom(get => {
    const location = get(this.location)
    return this.options.policy.canUpload({
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
    set(uploadFilesAtom(this.options.policy), {
      files,
      workspace: location.workspace,
      root: location.root,
      parentId: location.parentId
    })
  })
  getItems = atom(null, (_get, _set, keys: Set<Key>) => {
    return [...keys].map(key => ({'text/plain': String(key)}))
  })
  onAction = atom(null, (get, set, entry: ExplorerEntry) => {
    if (this.options.onAction) {
      this.options.onAction(entry)
      return
    }
    if (this.hasRowAction) {
      set(routeAtom, {
        workspace: entry.workspace,
        root: entry.root,
        entry: entry.id,
        locale: get(this.selectedLocale) ?? undefined
      })
      return
    }
    const {data} = get(entry.data)
    if (data && get(data.hasChildren))
      set(this.location, location => ({...location, parentId: entry.id}))
  })
  onConfirm = atom(null, get => {
    const selected = get(this.selection)
    if (selected !== 'all') this.options.onConfirm?.([...selected].map(String))
  })
  itemData = atom(async get => {
    get(shaAtom)
    const location = get(this.location)
    const search = get(this.search).trim()
    if (!location.root && this.rootScope === 'current') return []
    if (this.hideResultsUntilSearch && !search) return []
    const graph = get(graphAtom)
    const policy = this.options.policy
    const sort = get(this.sort)
    const filter = get(this.filter)
    const flatList =
      Boolean(search && this.searchDepth === 'all') ||
      Boolean(
        this.options.condition &&
        !this.options.pickChildren &&
        this.options.flatResults !== false
      )
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
      workspace: location.workspace,
      root: this.rootScope === 'workspace' ? undefined : location.root,
      parentId: flatList ? undefined : (location.parentId ?? null),
      locale: get(this.selectedLocale),
      search: search || undefined,
      filter: this.options.condition,
      type: filter,
      status: 'preferDraft',
      groupBy: Entry.id,
      orderBy: {
        [sort.direction]: orderField,
        caseSensitive: sort.sortBy !== 'id'
      },
      select: {
        id: Entry.id,
        title: Entry.title,
        path: Entry.path,
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
    const readable = entries.filter(entry => policy.canRead(entry))
    const parentIds = await graph.find({
      workspace: location.workspace,
      root: this.rootScope === 'workspace' ? undefined : location.root,
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
}

export function createExplorerAtoms(
  initialLocation: ExplorerLocation,
  options: ExplorerOptions
): ExplorerAtoms {
  return new ExplorerAtoms(atom(initialLocation), options, initialLocation)
}

export type DashboardEntry = ExplorerEntry
export type DashboardEntryData = ExplorerEntryData
export type DashboardExplorer = ExplorerAtoms
export type DashboardRoot = ExplorerRootData
