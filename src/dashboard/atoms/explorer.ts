import {UploadOperation} from '#/core/db/Operation.js'
import {filterChecker} from '#/core/db/EntryResolver.js'
import {Entry, type Entry as EntryRecord} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import type {Expr} from '#/core/Expr.js'
import type {Filter} from '#/core/Filter.js'
import {createId} from '#/core/Id.js'
import {createPreview} from '#/core/media/CreatePreview.browser.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Permission} from '#/core/Role.js'
import {assert} from '#/core/util/Assert.js'
import type {Getter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {SetStateAction} from 'react'
import type {Key} from 'react-aria-components'
import {entryAtoms, type EntryAtoms, type EntryDataAtoms} from './entry.js'
import {graphAtom, shaAtom} from './graph.js'
import {mutationQueueAtom, uploadProgressAtom} from './graph/queue.js'
import {policyAtom} from './user.js'
import {
  dashboardEntryDragItem,
  dispense,
  swr,
  uploadSizeError
} from './utils.js'
import {configAtom, type RootAtoms, workspaceAtoms} from './config.js'

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
  actionOnPress?: boolean
  autoSelectFirstItem?: boolean
  condition?: Filter<EntryFields>
  enableNavigation?: boolean
  flatResults?: boolean
  hideResultsUntilSearch?: boolean
  location?: ExplorerLocation
  mode?: 'browse' | 'search'
  nestedNavigation?: boolean
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
  onAction?: WritableAtom<void, [entry: EntryAtoms], void>
  onConfirm?: (selection: Array<string>) => void
}

export interface ExplorerSnapshot {
  items: Array<EntryAtoms>
  locale: string | null
  location: ExplorerLocation
}

export class ExplorerAtoms {
  #options: ExplorerOptions
  #conditionChecker: ReturnType<typeof filterChecker> | undefined
  #selectedLocale: DashboardLocaleSelection
  #navigationSequence = 0
  selection
  #expandedKeys = atom(new Set<Key>())
  expandedKeys = atom(
    get => get(this.#expandedKeys),
    async (get, set, next: Set<Key>) => {
      const current = get(this.#expandedKeys)
      const added = [...next].filter(key => !current.has(key))
      await Promise.all(
        added.map(async key => {
          const children = get(this.children(entryAtoms(String(key))))
          if (children instanceof Promise) await children
        })
      )
      set(this.#expandedKeys, next)
    }
  )
  constructor(
    public location: WritableAtom<
      ExplorerLocation,
      [SetStateAction<ExplorerLocation>],
      void
    >,
    options: ExplorerOptions
  ) {
    this.#options = options
    this.#conditionChecker = options.condition
      ? filterChecker(
          options.condition,
          (record: EntryRecord, name: string) => {
            if (name.startsWith('_')) {
              return record[name.slice(1) as keyof EntryRecord]
            }
            return record.data[name]
          }
        )
      : undefined
    this.#selectedLocale = atom(options.selectedLocale ?? null)
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

  get actionOnPress() {
    return this.#options.actionOnPress ?? false
  }

  get supportsInlineExpansion() {
    return this.#options.nestedNavigation ?? false
  }

  get breadcrumbs() {
    return this.#options.breadcrumbs ?? false
  }

  isSelectable = dispense((entry: EntryAtoms) =>
    atom(get => {
      if (!this.#conditionChecker) return true
      const {data} = get(entry.data)
      if (!data) return false
      const currentEntry = get(data.currentEntry)
      if (!currentEntry || currentEntry instanceof Promise) return false
      return this.#conditionChecker(currentEntry)
    })
  )

  isExpanded = dispense((entry: EntryAtoms) =>
    atom(get => get(this.expandedKeys).has(entry.id))
  )

  children = dispense((entry: EntryAtoms) =>
    swr(
      atom(async get => {
        get(shaAtom)
        const {data} = get(entry.data)
        if (!data || !get(data.entryData).hasChildren) return []
        const entryData = get(data.entryData)
        const root = get(data.root)
        const db = get(graphAtom)
        const policy = get(policyAtom)
        const locale = get(root.selectedLocale)
        const children = await db.find({
          locale,
          workspace: entryData.workspace,
          root: entryData.root,
          parentId: entry.id,
          select: {
            id: Entry.id,
            type: Entry.type,
            workspace: Entry.workspace,
            root: Entry.root,
            parents: Entry.parents,
            locale: Entry.locale
          },
          orderBy: this.#orderBy(get),
          status: 'preferDraft',
          type: get(this.filter),
          groupBy: Entry.id
        })
        const entries = children
          .filter(child => policy.canRead(child))
          .map(child => entryAtoms(child.id))
        await loadEntries(get, entries, locale)
        return entries
      })
    )
  )

  onAction = atom(null, (get, set, entry: EntryAtoms) => {
    if (this.#options.onAction) {
      set(this.#options.onAction, entry)
      return
    }
    const {data} = get(entry.data)
    if (data && get(data.entryData).hasChildren) {
      const location = get(this.location)
      set(this.location, {...location, parentId: entry.id})
    }
  })

  onConfirm = atom(null, get => {
    const selection = get(this.selection)
    if (this.#options.onConfirm)
      this.#options.onConfirm([...selection].map(String))
  })

  #search = atom('')
  search = atom(
    get => get(this.#search),
    (get, set, search: string) => {
      set(this.#search, search)
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
    (get, set, locale: string) => {
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
    }
  )
  #filter = atom<ExplorerTypeFilters | undefined>(undefined)
  filter = atom(
    get => get(this.#filter),
    (get, set, filterBy: ExplorerTypeFilters) => {
      const filter = get(this.#filter)
      const payload = filter === filterBy ? undefined : filterBy
      set(this.#filter, payload)
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
      await this.prepare(get, next, locale)
      if (sequence !== this.#navigationSequence) return
      set(this.location, next)
    }
  )
  getItems(keys: Set<Key>) {
    return [...keys].map(id => dashboardEntryDragItem(id))
  }

  isMedia = atom(get => {
    const root = get(this.root)
    return root ? get(root.settings).isMediaRoot : false
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

  async prepare(
    get: Getter,
    location: ExplorerLocation,
    locale: string | null,
    _signal?: AbortSignal
  ): Promise<ExplorerSnapshot> {
    const items = await this.#queryItems(get, location, locale)
    await loadEntries(get, items, locale)
    return {items, locale, location}
  }

  #snapshotResource = atom(async get => {
    const location = get(this.location)
    const allRoots = this.rootScope === 'workspace'
    const locale = allRoots ? null : get(this.selectedLocale)
    return this.prepare(get, location, locale)
  })
  snapshot = swr(this.#snapshotResource)

  items = swr(
    atom(async get => {
      const snapshot = await get(this.snapshot)
      return snapshot.items
    })
  )

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
    const filter = get(this.filter)
    const searchStarted = Boolean(search.trim())
    if (this.hideResultsUntilSearch && !searchStarted) return []
    const allRoots = this.rootScope === 'workspace'
    if (!root && !allRoots) return []
    const locale = allRoots ? undefined : selectedLocale
    const searchAll = Boolean(searchStarted && this.searchDepth === 'all')
    const flatList =
      this.#options.flatResults === true ||
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
      filter: flatList ? this.#options.condition : undefined,
      select: {
        id: Entry.id,
        type: Entry.type,
        workspace: Entry.workspace,
        root: Entry.root,
        parents: Entry.parents,
        locale: Entry.locale
      },
      orderBy: searchStarted ? undefined : this.#orderBy(get),
      status: 'preferDraft',
      type: filter,
      groupBy: Entry.id
    })
    const entries = children
      .filter(child => policy.canRead(child))
      .map(child => entryAtoms(child.id))
    return entries
  }

  #orderBy(get: Getter) {
    const sort = get(this.sort)
    const fieldMap: Record<ExplorerSortBy, Expr<string | number>> = {
      title: Entry.title,
      path: Entry.path,
      size: MediaFile.size,
      id: Entry.id,
      index: Entry.index
    }
    const field = fieldMap[sort.sortBy]
    return {
      [sort.direction]: field,
      caseSensitive: field !== Entry.id
    }
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
          .filter((entry): entry is EntryDataAtoms => entry !== undefined)
          .map(entry => ({id: entry.id, label: get(entry.label)})),
        {id: parent.id, label}
      ]
    }),
    prev => prev ?? []
  )
}

export function createExplorerAtoms(
  initialLocation: ExplorerLocation,
  options: ExplorerOptions = {}
): ExplorerAtoms {
  const firstSelection = options.location
    ? undefined
    : options.initialSelection?.[0]
  const selectedLocation = atom(async get => {
    if (!firstSelection) return undefined
    const {data} = await get(entryAtoms(firstSelection).readyState)
    if (!data) return undefined
    return {
      workspace: get(data.entryData).workspace,
      root: get(data.entryData).root,
      parentId: get(data.entryData).parentId ?? undefined
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
  return new ExplorerAtoms(location, options)
}

export interface PreparedExplorerPage {
  type: 'explorer'
  root: RootAtoms
  snapshot: ExplorerSnapshot
}

export type ExplorerPageData = PreparedExplorerPage

export async function loadEntryData(get: Getter, entry: EntryAtoms) {
  // Prime the synchronous state atom before awaiting its async source. Reading
  // readyState alone loads the data but leaves the UI-facing unwrap pending.
  get(entry.data)
  const ready = await get(entry.readyState)
  return ready.data
}

export async function loadEntries(
  get: Getter,
  entries: Array<EntryAtoms>,
  locale: string | null
) {
  await Promise.all(
    entries.map(async entry => {
      const data = await loadEntryData(get, entry)
      if (!data) return
      await Promise.all([get(data.currentEntryFor(locale)), get(data.fileInfo)])
    })
  )
}

export async function loadExplorerPage(
  get: Getter,
  root: RootAtoms,
  location: ExplorerLocation,
  locale: string | null,
  signal: AbortSignal
): Promise<ExplorerPageData> {
  const snapshot = await root.explorer.prepare(get, location, locale, signal)
  return {type: 'explorer', root, snapshot}
}
