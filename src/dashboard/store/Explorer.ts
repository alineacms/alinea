import {UploadOperation} from '#/core/db/Operation.js'
import {Entry} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import type {Expr} from '#/core/Expr.js'
import type {Filter} from '#/core/Filter.js'
import {createId} from '#/core/Id.js'
import {createPreview} from '#/core/media/CreatePreview.browser.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {assertUploadSize} from '#/core/media/UploadLimits.js'
import {Permission} from '#/core/Role.js'
import {assert} from '#/core/util/Assert.js'
import type {DragItem} from '@react-types/shared'
import type {Atom, Getter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {SetStateAction} from 'react'
import type {Key} from 'react-aria-components'
import type {
  Dashboard,
  DashboardEntry,
  DashboardEntryData
} from './Dashboard.js'

type DashboardUploadFiles = Iterable<File> | ArrayLike<File>

const DASHBOARD_ENTRY_DRAG_TYPE = 'application/x-alinea-entry-id'

function dragItem(id: Key): DragItem {
  const key = String(id)
  return {
    'text/plain': key,
    [DASHBOARD_ENTRY_DRAG_TYPE]: key
  }
}

function uploadSizeError(
  file: File,
  maxUploadSize: number | undefined
): string | undefined {
  try {
    assertUploadSize(file.name, file.size, maxUploadSize)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export interface ExplorerLocation {
  workspace: string
  root?: string
  parentId?: string
}

export interface DashboardMenuItem {
  id: string
  label: string
}

export type ExplorerSortBy = 'title' | 'path' | 'size' | 'id' | 'index'
export type ExplorerSortDirections = 'asc' | 'desc'
export type ExplorerSort = {
  sortBy: ExplorerSortBy
  direction: ExplorerSortDirections
}

export type ExplorerTypeFilters = typeof MediaFile | typeof MediaLibrary

export type DashboardLocaleSelection = WritableAtom<
  string | null,
  [locale: string],
  void
>

export interface ExplorerOptions {
  autoSelectFirstItem?: boolean
  condition?: Filter<EntryFields>
  enableNavigation?: boolean
  flatResults?: boolean
  hideResultsUntilSearch?: boolean
  location?: ExplorerLocation
  mode?: 'browse' | 'search'
  pickChildren?: boolean
  selectedLocale?: string | null
  rootScope?: 'current' | 'workspace'
  selectionMode?: 'none' | 'single' | 'multiple'
  selectionBehavior?: 'toggle' | 'replace'
  showSelectionControls?: boolean
  initialSelection?: Array<string>
  searchDepth?: 'current' | 'all'
  breadcrumbs?: boolean
  // initialSort?: ExplorerSort
  onAction?: WritableAtom<void, [entry: DashboardEntry], void>
  onConfirm?: (selection: Array<string>) => void
}

export class DashboardExplorer {
  #location: WritableAtom<
    ExplorerLocation,
    [SetStateAction<ExplorerLocation>],
    void
  >
  #options: ExplorerOptions
  #selectedLocale: DashboardLocaleSelection
  #items = new Map<string, Atom<Promise<Array<DashboardEntry>>>>()
  #navigationSequence = 0
  selection
  constructor(
    public dashboard: Dashboard,
    location: WritableAtom<
      ExplorerLocation,
      [SetStateAction<ExplorerLocation>],
      void
    >,
    options: ExplorerOptions
  ) {
    this.#location = location
    this.#options = options
    const selectedLocale = atom(options.selectedLocale ?? null)
    this.#selectedLocale = atom(
      get => get(selectedLocale),
      (_get, set, locale: string) => {
        set(selectedLocale, locale)
      }
    )
    this.selection = atom<'all' | Set<Key>>(
      new Set<Key>(options.initialSelection)
    )
  }

  get selectionMode() {
    return this.#options.selectionMode ?? 'single'
  }

  get selectionBehavior() {
    return this.#options.selectionBehavior ?? 'replace'
  }

  get hasSelection() {
    return this.selectionMode !== 'none'
  }

  get autoSelectFirstItem() {
    if (this.#options.autoSelectFirstItem !== undefined)
      return this.#options.autoSelectFirstItem
    return this.mode === 'search'
  }

  get hideResultsUntilSearch() {
    if (this.#options.hideResultsUntilSearch !== undefined)
      return this.#options.hideResultsUntilSearch
    return this.mode === 'search'
  }

  get mode() {
    return this.#options.mode ?? 'browse'
  }

  get searchDepth() {
    if (this.#options.searchDepth) return this.#options.searchDepth
    return this.mode === 'search' ? 'all' : 'current'
  }

  get rootScope() {
    if (this.#options.rootScope) return this.#options.rootScope
    return this.mode === 'search' ? 'workspace' : 'current'
  }

  get showSelectionControls() {
    if (this.#options.showSelectionControls !== undefined)
      return this.#options.showSelectionControls
    return this.mode !== 'search'
  }

  get hasRowAction() {
    return Boolean(this.#options.onAction)
  }

  get breadcrumbs() {
    return this.#options.breadcrumbs ?? false
  }

  onAction = atom(null, (get, set, entry: DashboardEntry) => {
    if (this.#options.onAction) {
      set(this.#options.onAction, entry)
      return
    }
    const {data} = get(entry.data)
    if (data && get(data.hasChildren)) {
      const location = get(this.location)
      set(this.location, {...location, parentId: entry.id})
    }
  })

  onConfirm = atom(null, (get, _set) => {
    const selection = get(this.selection)
    if (this.#options.onConfirm)
      this.#options.onConfirm([...selection].map(String))
  })

  #search = atom('')
  search = atom(
    get => get(this.#search),
    (_get, set, search: string) => {
      set(this.#search, search)
      void set(this.dashboard.refreshPageFor, this)
    }
  )
  showResults = atom(get => {
    if (!this.hideResultsUntilSearch) return true
    return Boolean(get(this.search).trim())
  })
  selectedLocale = atom(
    get => {
      const root = get(this.root)
      if (!root) return null
      const locale = get(this.#selectedLocale)
      if (locale) return locale
      return get(root.selectedLocale)
    },
    (_get, set, locale: string) => {
      set(this.#selectedLocale, locale)
    }
  )
  #selectedView = atom<'card' | 'row' | undefined>()
  view = atom(
    get => {
      const selected = get(this.#selectedView)
      if (selected) return selected
      const isMedia = get(this.isMedia)
      return isMedia ? 'card' : 'row'
    },
    (get, set, next: 'card' | 'row') => {
      set(this.#selectedView, next)
    }
  )
  #sort = atom<ExplorerSort | undefined>(undefined)
  sort = atom(
    get => {
      const selected = get(this.#sort)
      if (selected) return selected
      const isMedia = get(this.isMedia)
      return {
        sortBy: isMedia ? 'title' : 'index',
        direction: 'asc'
      } satisfies ExplorerSort
    },
    (get, set, sortBy: ExplorerSortBy) => {
      const sort = get(this.sort)
      const direction =
        sort.sortBy === sortBy && sort.direction === 'desc' ? 'asc' : 'desc'
      set(this.#sort, {sortBy, direction})
      void set(this.dashboard.refreshPageFor, this)
    }
  )
  #filter = atom<ExplorerTypeFilters | undefined>(undefined)
  filter = atom(
    get => get(this.#filter),
    (get, set, filterBy: ExplorerTypeFilters) => {
      const filter = get(this.#filter)
      const payload = filter === filterBy ? undefined : filterBy
      set(this.#filter, payload)
      void set(this.dashboard.refreshPageFor, this)
    }
  )
  location = atom(
    get => get(this.#location),
    (get, set, update: SetStateAction<ExplorerLocation>) => {
      set(this.#location, update)
    }
  )
  navigate = atom(
    null,
    async (get, set, update: SetStateAction<ExplorerLocation>) => {
      const sequence = ++this.#navigationSequence
      const current = get(this.location)
      const next = typeof update === 'function' ? update(current) : update
      const allRoots = this.rootScope === 'workspace'
      let locale: string | null = null
      if (!allRoots && next.root) {
        const root = this.dashboard.workspace(next.workspace).root(next.root)
        locale = get(this.#selectedLocale) ?? get(root.selectedLocale)
      }
      await get(this.itemsAt(next, locale))
      if (sequence !== this.#navigationSequence) return
      set(this.location, next)
    }
  )
  getItems = atom(null, (get, set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(id => dragItem(id))
  })

  isMedia = atom(get => {
    const root = get(this.root)
    return root ? get(root.isMedia) : false
  })

  canUpload = atom(get => {
    const location = get(this.location)
    const policy = get(this.dashboard.policy)
    return policy.canUpload({
      workspace: location.workspace,
      root: location.root,
      id: location.parentId
    })
  })

  uploadsInCurrentFolder = atom(get => {
    const location = get(this.location)
    const queue = get(this.dashboard.mutationQueue)
    return queue.entries.filter(entry => {
      if (!entry.upload) return false
      if (!entry.mutations.some(mutation => mutation.op === 'uploadFile'))
        return false
      return (
        entry.upload.workspace === location.workspace &&
        entry.upload.root === location.root &&
        (entry.upload.parentId ?? null) === (location.parentId ?? null)
      )
    })
  })

  upload = atom(null, async (get, set, files: DashboardUploadFiles) => {
    const location = get(this.location)
    const db = get(this.dashboard.db)
    const policy = get(this.dashboard.policy)
    policy.assert(Permission.Upload, {
      workspace: location.workspace,
      root: location.root,
      id: location.parentId
    })
    const uploadFiles = Array.from(files)
    if (uploadFiles.length === 0) return
    const maxUploadSize = get(this.dashboard.config).maxUploadSize
    const invalidUploads = uploadFiles.flatMap(file => {
      const error = uploadSizeError(file, maxUploadSize)
      return error ? [{id: createId(), file, error}] : []
    })
    if (invalidUploads.length > 0) {
      set(this.dashboard.uploadProgress, {
        type: 'fail',
        uploads: invalidUploads,
        destination: {
          workspace: location.workspace,
          root: location.root,
          parentId: location.parentId
        }
      })
    }
    const validFiles = uploadFiles.filter(
      file => !invalidUploads.some(upload => upload.file === file)
    )
    if (validFiles.length === 0) return
    const ops = validFiles.map(file => {
      const op = new UploadOperation({
        file,
        createPreview: createPreview,
        parentId: location.parentId,
        workspace: location.workspace,
        root: location.root,
        onProgress: progress => {
          set(this.dashboard.uploadProgress, {
            type: 'progress',
            id: op.id,
            progress
          })
        }
      })
      return op
    })
    const uploads = validFiles.map((file, index) => ({
      id: ops[index]!.id,
      file
    }))
    const ids = uploads.map(upload => upload.id)
    set(this.dashboard.uploadProgress, {
      type: 'start',
      uploads,
      destination: {
        workspace: location.workspace,
        root: location.root,
        parentId: location.parentId
      }
    })
    try {
      await db.commit(...ops)
    } finally {
      set(this.dashboard.uploadProgress, {type: 'finish', ids})
    }
  })

  workspace = atom(
    get => {
      const {workspace} = get(this.location)
      return this.dashboard.workspace(workspace)
    },
    (get, set, update: string) => {
      const roots = get(this.dashboard.workspace(update).roots)
      assert(roots[0], `No readable roots found for workspace "${update}"`)
      set(this.location, {workspace: update, root: roots[0]})
    }
  )

  root = atom(
    get => {
      const {root} = get(this.location)
      if (!root) return
      const workspace = get(this.workspace)
      return workspace.root(root)
    },
    (get, set, update: string) => {
      const workspace = get(this.workspace)
      set(this.location, {workspace: workspace.key, root: update})
    }
  )

  parent = atom(
    get => {
      const {parentId} = get(this.location)
      if (!parentId) return
      return this.dashboard.entries(parentId)
    },
    (get, set, parentId: string | undefined) => {
      const location = get(this.location)
      set(this.location, {...location, parentId})
    }
  )

  itemsAt(
    location: ExplorerLocation,
    locale: string | null
  ): Atom<Promise<Array<DashboardEntry>>> {
    const key = JSON.stringify([
      location.workspace,
      location.root ?? null,
      location.parentId ?? null,
      locale
    ])
    const cached = this.#items.get(key)
    if (cached) return cached
    const items = atom(async get => {
      return this.#queryItems(get, location, locale)
    })
    this.#items.set(key, items)
    return items
  }

  items = atom(async get => {
    const location = get(this.location)
    const allRoots = this.rootScope === 'workspace'
    const locale = allRoots ? null : get(this.selectedLocale)
    return get(this.itemsAt(location, locale))
  })

  async #queryItems(
    get: Getter,
    location: ExplorerLocation,
    selectedLocale: string | null
  ) {
    get(this.dashboard.sha) // subscribe to content changes, todo: refine
    const db = get(this.dashboard.db)
    const search = get(this.search)
    const root = location.root
      ? this.dashboard.workspace(location.workspace).root(location.root)
      : undefined
    const isMedia = root ? get(root.isMedia) : false
    const sort = get(this.#sort) ?? {
      sortBy: isMedia ? 'title' : 'index',
      direction: 'asc'
    }
    const filter = get(this.filter)
    const searchStarted = Boolean(search.trim())
    const fieldMap: Record<ExplorerSortBy, Expr<string | number>> = {
      title: Entry.title,
      path: Entry.path,
      size: MediaFile.size,
      id: Entry.id,
      index: Entry.index
    }
    const fieldToSort = fieldMap[sort.sortBy]
    const orderBy = {
      [sort.direction]: fieldToSort,
      caseSensitive: fieldToSort !== Entry.id
    }
    if (this.hideResultsUntilSearch && !searchStarted) return []
    const allRoots = this.rootScope === 'workspace'
    if (!root && !allRoots) return []
    const locale = allRoots ? undefined : selectedLocale
    const searchAll = Boolean(searchStarted && this.searchDepth === 'all')
    const flatList =
      (Boolean(this.#options.condition) &&
        !this.#options.pickChildren &&
        this.#options.flatResults !== false) ||
      searchAll
    const policy = get(this.dashboard.policy)
    const children = await db.find({
      locale,
      search: searchStarted ? search : undefined,
      workspace: location.workspace,
      root: allRoots ? undefined : location.root,
      parentId: flatList ? undefined : (location.parentId ?? null),
      filter: this.#options.condition,
      select: {
        id: Entry.id,
        type: Entry.type,
        workspace: Entry.workspace,
        root: Entry.root,
        parents: Entry.parents,
        locale: Entry.locale
      },
      orderBy,
      status: 'preferDraft',
      type: filter,
      groupBy: Entry.id
    })
    const entries = children
      .filter(child => policy.canRead(child))
      .map(child => this.dashboard.entries(child.id))
    await Promise.all(entries.map(entry => get(entry.preload)))
    return entries
  }

  parentsMenu = unwrap(
    atom(async get => {
      const {parentId} = get(this.location)
      if (!parentId) return []
      const parent = this.dashboard.entries(parentId)
      assert(parent, 'Parent entry not found')
      const {data: parentData} = get(parent.data)
      if (!parentData) return []
      const parents = await get(parentData.parents)
      const label = get(parentData.label)
      return [
        ...parents
          .map(entry => get(entry.data).data)
          .filter((entry): entry is DashboardEntryData => entry !== undefined)
          .map(entry => ({id: entry.id, label: get(entry.label)})),
        {id: parent.id, label}
      ]
    }),
    prev => prev ?? []
  )
}
