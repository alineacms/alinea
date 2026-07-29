import {UploadOperation} from '#/core/db/Operation.js'
import {Entry} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import type {Expr} from '#/core/Expr.js'
import type {Filter} from '#/core/Filter.js'
import {createId} from '#/core/Id.js'
import {createPreview} from '#/core/media/CreatePreview.browser.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Permission} from '#/core/Role.js'
import {assert} from '#/core/util/Assert.js'
import type {Atom, Getter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {SetStateAction} from 'react'
import type {Key} from 'react-aria-components'
import {entryAtoms, type EntryDataState, type EntryState} from './EntryAtoms.js'
import {configAtom, graphAtom} from './CoreAtoms.js'
import {mutationQueueAtom, uploadProgressAtom} from './MutationAtoms.js'
import {refreshPageForAtom} from './PageAtoms.js'
import {policyAtom} from './PolicyAtoms.js'
import {shaAtom} from './SyncAtoms.js'
import {workspaceAtoms} from './WorkspaceAtoms.js'
import {dashboardEntryDragItem, uploadSizeError} from './AtomUtils.js'

type DashboardUploadFiles = Iterable<File> | ArrayLike<File>

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
export interface ExplorerSort {
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
  onAction?: WritableAtom<void, [entry: EntryState], void>
  onConfirm?: (selection: Array<string>) => void
}

class ExplorerModel {
  #location: WritableAtom<
    ExplorerLocation,
    [SetStateAction<ExplorerLocation>],
    void
  >
  #options: ExplorerOptions
  #selectedLocale: DashboardLocaleSelection
  #items = new Map<string, Atom<Promise<Array<EntryState>>>>()
  #navigationSequence = 0
  selection
  constructor(
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

  onAction = atom(null, (get, set, entry: EntryState) => {
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
      void set(refreshPageForAtom, this)
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
      void set(refreshPageForAtom, this)
    }
  )
  #filter = atom<ExplorerTypeFilters | undefined>(undefined)
  filter = atom(
    get => get(this.#filter),
    (get, set, filterBy: ExplorerTypeFilters) => {
      const filter = get(this.#filter)
      const payload = filter === filterBy ? undefined : filterBy
      set(this.#filter, payload)
      void set(refreshPageForAtom, this)
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
        const root = workspaceAtoms(next.workspace).root(next.root)
        locale = get(this.#selectedLocale) ?? get(root.selectedLocale)
      }
      await get(this.itemsAt(next, locale))
      if (sequence !== this.#navigationSequence) return
      set(this.location, next)
    }
  )
  getItems = atom(null, (get, set, keys: Set<Key>) => {
    return [...keys].map(id => dashboardEntryDragItem(id))
  })

  isMedia = atom(get => {
    const root = get(this.root)
    return root ? get(root.isMedia) : false
  })

  canUpload = atom(get => {
    const location = get(this.location)
    const policy = get(policyAtom)
    return policy.canUpload({
      workspace: location.workspace,
      root: location.root,
      id: location.parentId
    })
  })

  uploadsInCurrentFolder = atom(get => {
    const location = get(this.location)
    const queue = get(mutationQueueAtom)
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
    const db = get(graphAtom)
    const policy = get(policyAtom)
    policy.assert(Permission.Upload, {
      workspace: location.workspace,
      root: location.root,
      id: location.parentId
    })
    const uploadFiles = Array.from(files)
    if (uploadFiles.length === 0) return
    const maxUploadSize = get(configAtom).maxUploadSize
    const invalidUploads = uploadFiles.flatMap(file => {
      const error = uploadSizeError(file, maxUploadSize)
      return error ? [{id: createId(), file, error}] : []
    })
    if (invalidUploads.length > 0) {
      set(uploadProgressAtom, {
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
          set(uploadProgressAtom, {
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
    set(uploadProgressAtom, {
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
      set(uploadProgressAtom, {type: 'finish', ids})
    }
  })

  workspace = atom(
    get => {
      const {workspace} = get(this.location)
      return workspaceAtoms(workspace)
    },
    (get, set, update: string) => {
      const roots = get(workspaceAtoms(update).roots)
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
      return entryAtoms(parentId)
    },
    (get, set, parentId: string | undefined) => {
      const location = get(this.location)
      set(this.location, {...location, parentId})
    }
  )

  itemsAt(
    location: ExplorerLocation,
    locale: string | null
  ): Atom<Promise<Array<EntryState>>> {
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
    get(shaAtom) // subscribe to content changes, todo: refine
    const db = get(graphAtom)
    const search = get(this.search)
    const root = location.root
      ? workspaceAtoms(location.workspace).root(location.root)
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
    const policy = get(policyAtom)
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
      .map(child => entryAtoms(child.id))
    await Promise.all(entries.map(entry => get(entry.preload)))
    return entries
  }

  parentsMenu = unwrap(
    atom(async get => {
      const {parentId} = get(this.location)
      if (!parentId) return []
      const parent = entryAtoms(parentId)
      assert(parent, 'Parent entry not found')
      const {data: parentData} = get(parent.data)
      if (!parentData) return []
      const parents = await get(parentData.parents)
      const label = get(parentData.label)
      return [
        ...parents
          .map(entry => get(entry.data).data)
          .filter((entry): entry is EntryDataState => entry !== undefined)
          .map(entry => ({id: entry.id, label: get(entry.label)})),
        {id: parent.id, label}
      ]
    }),
    prev => prev ?? []
  )
}

export type Explorer = Pick<ExplorerModel, keyof ExplorerModel>

export function createExplorer(
  location: WritableAtom<
    ExplorerLocation,
    [SetStateAction<ExplorerLocation>],
    void
  >,
  options: ExplorerOptions
): Explorer {
  return new ExplorerModel(location, options)
}

export function createExplorerAtoms(
  initialLocation: ExplorerLocation,
  options: ExplorerOptions = {}
): Explorer {
  const firstSelection = options.location
    ? undefined
    : options.initialSelection?.[0]
  const selectedLocation = atom(async get => {
    if (!firstSelection) return undefined
    const {data} = await get(entryAtoms(firstSelection).readyState)
    if (!data) return undefined
    return {
      workspace: get(data.workspaceKey),
      root: get(data.rootKey),
      parentId: get(data.parentId) ?? undefined
    } satisfies ExplorerLocation
  })
  const fallbackLocation = atom(initialLocation)
  const hasManualLocation = atom(false)
  const location = atom(
    get => {
      if (get(hasManualLocation)) return get(fallbackLocation)
      return (
        get(unwrap(selectedLocation, previous => previous)) ??
        get(fallbackLocation)
      )
    },
    (get, set, update: SetStateAction<ExplorerLocation>) => {
      const current = get(location)
      const next = typeof update === 'function' ? update(current) : update
      set(hasManualLocation, true)
      set(fallbackLocation, next)
    }
  )
  return createExplorer(location, options)
}
