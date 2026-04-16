import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {UploadOperation} from '#/core/db/Operation.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {Entry, EntryStatus} from '#/core/Entry.js'
import {Field, FieldOptions} from '#/core/Field.js'
import type {Order} from '#/core/Graph.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {createPreview} from '#/core/media/CreatePreview.js'
import {Section} from '#/core/Section.js'
import {FieldGetter, optionTrackerOf} from '#/core/Tracker.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {entries, fromEntries, values} from '#/core/util/Objects.js'
import {parents, translations} from '#/query.js'
import {DragItem, type DropItem, type ItemDropTarget} from '@react-types/shared'
import type {Atom, Getter, Setter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {atomWithLocation} from 'jotai-location'
import {unwrap} from 'jotai/utils'
import {SetStateAction, startTransition, type ComponentType} from 'react'
import type {
  DroppableCollectionInsertDropEvent,
  DroppableCollectionOnItemDropEvent,
  DroppableCollectionReorderEvent,
  Key
} from 'react-aria-components'
import {WorkerDB} from '../boot/WorkerDB.js'
import {IcRoundDescription} from '../icons.js'

export interface DashboardRoute {
  workspace?: string
  root?: string
  entry?: string
  locale?: string
}

type DashboardTreeSelection = WritableAtom<
  Set<Key>,
  [next: 'all' | Set<Key>],
  Promise<void>
>

type FocusedItem = {entry: DashboardEntry} | {root: DashboardRoot} | null

export class Dashboard {
  graph
  config
  client
  views
  db: Atom<WriteableGraph>
  events: Atom<EventTarget>

  constructor(
    graph: WriteableGraph,
    config: Config,
    events: EventTarget,
    client: LocalConnection = undefined!,
    views: Record<string, ComponentType>
  ) {
    this.graph = atom(graph)
    this.config = atom(config)
    this.events = atom(events)
    this.client = atom(client)
    this.views = atom(views)
    this.db = Object.assign(
      atom(
        get => get(this.graph),
        (get, set) => {
          const events = get(this.events)
          // Listen to db changes and update entry revisions
          const listen = (event: Event) => {
            if (event instanceof IndexEvent && event.data.op === 'entry') {
              set(this.revisions(event.data.id), current => current + 1)
            }
          }
          events.addEventListener(IndexEvent.type, listen)
          return () => {
            events.removeEventListener(IndexEvent.type, listen)
          }
        }
      ),
      {
        onMount(init: () => void) {
          init()
        }
      }
    )
  }

  revisions = dispense(id => atom(0))

  #location = atomWithLocation({
    subscribe(setLocation) {
      // workaround facebook/react#35966
      const transition = () =>
        requestAnimationFrame(() => startTransition(setLocation))
      window.addEventListener('popstate', transition)
      return () => window.removeEventListener('popstate', transition)
    }
  })

  route = atom(
    get => {
      const {hash = '/'} = get(this.#location)
      const [action, workspace, rootPart = '', entry] = hash
        .slice(1)
        .split('/')
        .slice(1) as Array<string | undefined>
      const [root, locale] = rootPart.split(':')
      return {workspace, root, entry, locale}
    },
    async (get, set, update: DashboardRoute) => {
      const focused = await get(this.focused)
      const confirm = () => {
        let {workspace, root, entry, locale} = update
        const rootPart = root ? `${root}${locale ? `:${locale}` : ''}` : ''
        const pathname = `/entry/${[workspace, rootPart, entry].filter(Boolean).join('/')}`
        startTransition(() => {
          set(this.#location, {hash: `#${pathname}`})
        })
      }
      if (focused && 'entry' in focused) {
        const blockNavigation = set(focused.entry.needsBlock, confirm)
        if (blockNavigation) return
      }
      confirm()
    }
  )

  focused = atom(async (get): Promise<FocusedItem> => {
    const root = get(this.selectedRoot)
    const workspace = get(this.selectedWorkspace)
    const {entry} = get(this.route)
    if (entry)
      try {
        return {entry: await get(this.entries(entry))}
      } catch {}
    if (!workspace) return null
    if (root) return {root: this.workspace(workspace).root(root)}
    return null
  })

  #sha = atom<string>()
  sha = Object.assign(
    atom(
      get => get(this.#sha),
      (get, set) => {
        const events = get(this.events)
        const listen = (event: Event) => {
          if (event instanceof IndexEvent && event.data.op === 'index')
            set(this.#sha, event.data.sha)
        }
        events.addEventListener(IndexEvent.type, listen)
        return () => {
          events.removeEventListener(IndexEvent.type, listen)
        }
      }
    ),
    {onMount: (init: () => void) => init()}
  )

  sync = atom(null, (get, set) => {
    const db = get(this.db)
    if (db instanceof WorkerDB) {
      return db.sync()
    }
  })

  selectedWorkspace = atom(
    get => {
      const {workspace} = get(this.route)
      const config = get(this.config)
      if (workspace && config.workspaces[workspace]) return workspace
      const workspaceKeys = Object.keys(config.workspaces)
      return workspaceKeys[0] ?? null
    },
    (get, set, workspace: string) => {
      startTransition(() => {
        set(this.route, {workspace})
      })
    }
  )

  selectedRoot = atom(get => {
    const {root} = get(this.route)
    if (root) return root
    const workspace = get(this.currentWorkspace)
    const roots = workspace ? get(workspace.roots) : []
    const first = roots[0]
    if (!first) throw new Error('No root found in workspace')
    return first
  })

  workspaces = atom(get => {
    const config = get(this.config)
    return Object.keys(config.workspaces)
  })

  workspace = dispense(key => new DashboardWorkspace(this, key))

  workspaceMenu = atom(get => {
    const workspaces = get(this.workspaces)
    return workspaces.map(workspace => ({
      id: workspace,
      label: get(this.workspace(workspace).label),
      icon: get(this.workspace(workspace).icon)
    }))
  })

  currentWorkspace = atom(get => {
    const workspaceKey = get(this.selectedWorkspace)
    return workspaceKey ? this.workspace(workspaceKey) : null
  })

  currentRoot = atom(get => {
    const workspace = get(this.currentWorkspace)
    const rootKey = get(this.selectedRoot)
    return workspace ? workspace.root(rootKey) : null
  })

  type = dispense(key => {
    return atom(get => {
      const config = get(this.config)
      const type = config.schema[key]
      assert(type, `Type "${key}" not found in config`)
      return new DashboardType(this, type)
    })
  })

  view = dispense(key => {
    return atom(get => {
      const views = get(this.views)
      const component = views[key]
      // assert(component, `View "${key}" not found in views`)
      return component
    })
  })

  explore(initialLocation: ExplorerLocation, options: ExplorerOptions = {}) {
    return new DashboardExplorer(this, atom(initialLocation), options)
  }

  entries = dispense(id => {
    const data = atom<Promise<EntryData>>(get => {
      // todo: this will get out of sync for hasChildren
      const load = get(this.#entryLoader)
      return load(id).then(([result, error]) => {
        if (error) throw new Error('Could not load entry', {cause: error})
        return result
      })
    })
    const entry = new DashboardEntry(this, id, swr(data) as Atom<EntryData>)
    return swr(
      atom(async get => {
        get(this.revisions(id))
        await get(data)
        return entry
      })
    )
  })

  #entryLoader = atom(get => {
    const db = get(this.db)
    return loader(async ids => {
      const data = {
        title: Entry.title,
        status: Entry.status,
        locale: Entry.locale,
        main: Entry.main,
        path: Entry.path,
        fileHash: Entry.fileHash
      }
      const rows = await db.find({
        groupBy: Entry.id,
        select: {
          id: Entry.id,
          type: Entry.type,
          parentId: Entry.parentId,
          workspace: Entry.workspace,
          root: Entry.root,
          parents: parents({
            select: {
              id: Entry.id,
              path: Entry.path,
              type: Entry.type
            }
          }),
          entries: translations({select: data, includeSelf: true})
        },
        id: {in: ids},
        status: 'preferDraft'
      })
      const parentIds = await db.find({
        select: Entry.parentId,
        parentId: {in: ids},
        groupBy: Entry.parentId,
        status: 'preferDraft'
      })
      const byId = new Map(rows.map(row => [row.id, row] as const))
      return ids.map(id => {
        const row = byId.get(id)
        if (!row) return [null, new Error(`Missing entry ${id}`)] as const
        return [{...row, hasChildren: parentIds.includes(id)}, null] as const
      })
    })
  })

  createEntry = atom(null, async (get, set, request) => {})
}

export class DashboardEditor {
  value: Atom<object>
  sections: Array<DashboardSection>
  constructor(
    public dashboard: Dashboard,
    public type: Type,
    public node: ReactiveNode<object>
  ) {
    this.value = node.value
    this.sections = getType(this.type).sections.map(
      section => new DashboardSection(this.dashboard, section)
    )
  }
  field = dispense(key => {
    const fields = getType(this.type).allFields
    const field = fields[key]
    if (!field) return undefined
    return new DashboardField(this, key, field)
  })
  #keyOfField(field: Field) {
    const fields = getType(this.type).allFields
    for (const [key, candidate] of Object.entries(fields)) {
      if (candidate === field) return key
    }
    throw new Error(`Field not found in type: ${Field.label(field)}`)
  }
  get(field: Field) {
    const key = this.#keyOfField(field)
    return this.field(key)
  }
}

export class DashboardSection {
  constructor(
    public dashboard: Dashboard,
    public section: Section
  ) {}

  view = atom(get => {
    const view = Section.view(this.section)
    if (typeof view === 'string') return get(this.dashboard.view(view))
    return view
  })
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

export interface ExplorerOptions {
  selectionMode?: 'single' | 'multiple'
  selectionBehavior?: 'toggle' | 'replace'
  initialSelection?: Array<string>
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

  onAction = atom(null, (get, set, entry: DashboardEntry) => {
    if (this.#options.onAction) set(this.#options.onAction, entry)
  })

  onConfirm = atom(null, (get, set) => {
    const selection = get(this.selection)
    if (this.#options.onConfirm)
      this.#options.onConfirm([...selection].map(String))
  })

  search = atom('')
  view = atom<'card' | 'row'>('row')
  location = atom(
    get => get(this.#location),
    (get, set, update: SetStateAction<ExplorerLocation>) => {
      set(this.#location, update)
    }
  )
  getItems = atom(null, (get, set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(id => dragItem(id))
  })

  isMedia = atom(get => {
    const root = get(this.root)
    return root ? get(root.isMedia) : false
  })

  upload = atom(null, (get, set, files: FileList) => {
    const location = get(this.location)
    const db = get(this.dashboard.db)
    const ops = Array.from(
      files,
      file =>
        new UploadOperation({
          file,
          createPreview: createPreview,
          parentId: location.parentId,
          workspace: location.workspace,
          root: location.root
        })
    )
    return db.commit(...ops)
  })

  workspace = atom(
    get => {
      const {workspace} = get(this.location)
      return this.dashboard.workspace(workspace)
    },
    (get, set, update: string) => {
      const roots = get(this.dashboard.workspace(update).roots)
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
      return get(this.dashboard.entries(parentId))
    },
    (get, set, parentId: string | undefined) => {
      const location = get(this.location)
      set(this.location, {...location, parentId})
    }
  )

  items = atomWithPending(
    atom(async get => {
      get(this.dashboard.sha) // subscribe to content changes, todo: refine
      const location = get(this.location)
      const db = get(this.dashboard.db)
      const search = get(this.search)
      const root = get(this.root)
      if (!root) return []
      const locale = get(root.selectedLocale)
      const children = await db.find({
        locale,
        search: search || undefined,
        workspace: location.workspace,
        root: location.root,
        parentId: location.parentId ?? null,
        select: Entry.id,
        status: 'preferDraft'
      })
      return Promise.all(
        children.map(id => this.dashboard.entries(id)).map(get)
      )
    })
  )

  parentsMenu = unwrap(
    atom(async get => {
      const {parentId} = get(this.location)
      if (!parentId) return []
      const parent = await get(this.dashboard.entries(parentId))
      const parents = await get(parent.parents)
      const label = get(parent.label)
      return [
        ...parents.map(entry => ({id: entry.id, label: get(entry.label)})),
        {id: parent.id, label}
      ]
    }),
    prev => prev ?? []
  )
}

export class DashboardField {
  value: WritableAtom<unknown, [unknown], void>

  constructor(
    public draft: DashboardEditor,
    public key: string,
    public field: Field
  ) {
    this.value = this.draft.node.field(key)
  }

  #getter = atom(get => {
    return ((field: Field) => {
      const info = this.draft.get(field)
      assert(info, `Field not found: ${Field.label(field)}`)
      return get(info.value)
    }) as FieldGetter
  })

  options = atom(get => {
    const defaultOptions = Field.options(this.field)
    const tracker = optionTrackerOf(this.field)
    const update = tracker ? tracker(get(this.#getter)) : undefined
    return {...defaultOptions, ...update}
  })

  error = atom((get): string | undefined => {
    const options = get(this.options) as FieldOptions<unknown>
    const value = get(this.value)
    if (options.validate) {
      const result = options.validate(value)
      if (typeof result === 'boolean')
        return result ? 'Field is invalid' : undefined
      return result
    }
    if (options.required) {
      if (value === undefined || value === null) return 'Field is required'
      if (typeof value === 'string' && value === '') return 'Field is required'
      if (Array.isArray(value) && value.length === 0) return 'Field is required'
    }
    return undefined
  })

  view = atom(get => {
    const view = Field.view(this.field)
    if (typeof view === 'string') return get(this.draft.dashboard.view(view))
    return view
  })
}

export class DashboardType {
  constructor(
    public dashboard: Dashboard,
    public type: Type
  ) {}

  get contains() {
    return getType(this.type).contains
  }
  get label() {
    return getType(this.type).label
  }
  get orderChildrenBy() {
    return getType(this.type).orderChildrenBy
  }
  get icon() {
    return getType(this.type).icon
  }
  get sections() {
    return getType(this.type).sections
  }
}

const ROOT_KEY_PREFIX = 'root:'

export class DashboardWorkspace {
  constructor(
    public dashboard: Dashboard,
    public key: string
  ) {}

  #treeSelection = atom(
    get => {
      const route = get(this.dashboard.route)
      if (route.workspace && route.workspace !== this.key) return new Set<Key>()
      if (route.entry) return new Set<Key>([route.entry])
      if (route.root) return new Set<Key>([`root:${route.root}`])
      return new Set<Key>()
    },
    async (get, set, next: 'all' | Set<Key>) => {
      if (next === 'all')
        throw new Error('Selecting all items is not supported')
      const current = get(this.dashboard.route)
      const selectedKey = next.values().next().value
      if (!selectedKey) {
        set(this.dashboard.route, {workspace: this.key})
        return
      }
      const selectedId = String(selectedKey)
      if (selectedId.startsWith(ROOT_KEY_PREFIX)) {
        set(this.dashboard.route, {
          workspace: this.key,
          root: selectedId.slice(ROOT_KEY_PREFIX.length),
          locale: current.locale
        })
        return
      }
      const {rootKey: root, workspaceKey: workspace} = await get(
        this.dashboard.entries(selectedId)
      )
      set(this.dashboard.route, {
        workspace: get(workspace),
        root: get(root),
        entry: selectedId,
        locale: current.locale
      })
    }
  )

  tree = new DashboardTree(this, this.#treeSelection)

  #settings = atom(get => {
    const config = get(this.dashboard.config)
    const workspaceConfig = config.workspaces[this.key]
    assert(workspaceConfig, `Workspace "${this.key}" not found in config`)
    return getWorkspace(workspaceConfig)
  })

  color = atom(get => get(this.#settings).color)
  label = atom(get => get(this.#settings).label)
  icon = atom(get => get(this.#settings).icon)

  roots = atom(get => {
    const roots = get(this.#settings).roots
    return Object.keys(roots)
  })

  root = dispense(key => new DashboardRoot(this, key))

  rootMenu = atom(get => {
    const roots = get(this.roots)
    return roots.map(root => ({
      id: root,
      label: get(this.root(root).label),
      icon: get(this.root(root).icon)
    }))
  })
}

export class DashboardTree {
  #treeSelection: DashboardTreeSelection
  constructor(
    private workspace: DashboardWorkspace,
    treeSelection: DashboardTreeSelection
  ) {
    this.#treeSelection = treeSelection
  }

  #routeExpandedKeys = atom(async get => {
    const route = get(this.workspace.dashboard.route)
    if (!route.entry || route.workspace !== this.workspace.key)
      return new Set<Key>()
    const {parentIds} = await get(this.workspace.dashboard.entries(route.entry))
    const keys = new Set<Key>(get(parentIds))
    if (route.root) keys.add(`${ROOT_KEY_PREFIX}${route.root}`)
    return keys
  })

  expandedKeys = Object.assign(
    atom(
      get => get(this.#expandedKeys),
      (get, set, next: 'init' | Set<Key>) => {
        startTransition(() => {
          if (next === 'init') {
            get(this.#routeExpandedKeys).then(routeKeys => {
              if (routeKeys.size === 0) return
              const current = get(this.#expandedKeys)
              const merged = new Set(current)
              for (const key of routeKeys) merged.add(key)
              set(this.#expandedKeys, merged)
            })
          } else {
            set(this.#expandedKeys, next)
          }
        })
      }
    ),
    {onMount: (setSelf: (value: 'init') => void) => setSelf('init')}
  )
  #expandedKeys = atom(new Set<Key>())

  selectedKeys = atom(
    get => get(this.#treeSelection),
    (get, set, next: 'all' | Set<Key>) => {
      startTransition(() => {
        assert(next !== 'all', 'Selecting all items is not supported')
        const [first] = next
        if (first) {
          const expandedKeys = get(this.#expandedKeys)
          if (!expandedKeys.has(first))
            set(this.#expandedKeys, new Set(expandedKeys).add(first))
        }
        set(this.#treeSelection, next)
      })
    }
  )

  entryItems: (id: string) => Atom<Promise<DashboardTreeItem>> = dispense(
    (id: string): Atom<Promise<DashboardTreeItem>> => {
      return atom(async (get): Promise<DashboardTreeItem> => {
        const entry = await get(this.workspace.dashboard.entries(id))
        return new DashboardTreeItem(
          this,
          id,
          entry.icon,
          entry.label,
          atom(async (get): Promise<Array<DashboardTreeItem>> => {
            const children = await get(entry.children)
            for (const childId of children) get(this.entryItems(childId))
            return Promise.all(
              children.map(childId => this.entryItems(childId)).map(get)
            )
          }),
          get(entry.hasChildren)
        )
      })
    }
  )

  rootItems: (key: string) => Atom<Promise<DashboardTreeItem>> = dispense(
    (key: string): Atom<Promise<DashboardTreeItem>> => {
      return atom(async (get): Promise<DashboardTreeItem> => {
        const root = this.workspace.root(key)
        const hasChildren = await get(root.hasChildren)
        return new DashboardTreeItem(
          this,
          `${ROOT_KEY_PREFIX}${root.key}`,
          root.icon,
          root.label,
          atom(async (get): Promise<Array<DashboardTreeItem>> => {
            const ids = await get(root.children)
            return Promise.all(ids.map(id => this.entryItems(id)).map(get))
          }),
          hasChildren
        )
      })
    }
  )

  items = atom(get => {
    const roots = get(this.workspace.roots)
    return Promise.all(roots.map(key => this.rootItems(key)).map(get))
  })

  // dnd
  getItems = atom(null, (get, set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(id => dragItem(id))
  })

  onMove = atom(
    null,
    async (get, set, event: DroppableCollectionReorderEvent) => {
      await this.#moveDraggedKeys(get, event.keys, event.target)
    }
  )

  onInsert = atom(
    null,
    async (get, set, event: DroppableCollectionInsertDropEvent) => {
      await this.#moveDropItems(get, event.items, event.target)
    }
  )

  onItemDrop = atom(
    null,
    async (get, set, event: DroppableCollectionOnItemDropEvent) => {
      await this.#moveDropItems(get, event.items, event.target)
    }
  )

  async #moveDraggedKeys(get: Getter, keys: Set<Key>, target: ItemDropTarget) {
    const db = get(this.workspace.dashboard.db)
    const {moveTarget, targetType} = this.#target(target.key)
    for (const key of keys) {
      const draggedId = String(key)
      if (draggedId.startsWith(ROOT_KEY_PREFIX)) continue
      await db.move({
        id: draggedId,
        target: moveTarget,
        targetType,
        dropPosition: target.dropPosition
      })
    }
  }

  async #moveDropItems(
    get: Getter,
    items: Array<DropItem>,
    target: ItemDropTarget
  ) {
    const draggedKeys = new Set<Key>()
    for (const item of items) {
      if (item.kind !== 'text' || !item.types || !item.getText) continue
      let draggedId: string | null = null
      if (item.types.has(DASHBOARD_ENTRY_DRAG_TYPE)) {
        draggedId = await item.getText(DASHBOARD_ENTRY_DRAG_TYPE)
      } else if (item.types.has('text/plain')) {
        draggedId = await item.getText('text/plain')
      }
      if (!draggedId || draggedId.startsWith(ROOT_KEY_PREFIX)) continue
      draggedKeys.add(draggedId)
    }
    await this.#moveDraggedKeys(get, draggedKeys, target)
  }

  #target(key: Key) {
    const targetId = String(key)
    return {
      moveTarget: targetId.startsWith(ROOT_KEY_PREFIX)
        ? targetId.slice(ROOT_KEY_PREFIX.length)
        : targetId,
      targetType: targetId.startsWith(ROOT_KEY_PREFIX) ? 'root' : 'entry'
    } as const
  }

  visibleTypes = atom(get => {
    const config = get(this.workspace.dashboard.config)
    return Object.entries(config.schema)
      .filter(([, type]) => !Type.isHidden(type))
      .map(([name]) => name)
  })
}

type Awaitable<T> = T | Promise<T>

export class DashboardTreeItem {
  constructor(
    public tree: DashboardTree,
    public id: string,
    public icon: Atom<ComponentType | undefined>,
    public label: Atom<string>,
    public items: Atom<Awaitable<Array<DashboardTreeItem>>>,
    public hasChildren: boolean
  ) {}

  isExpanded = atom(get => get(this.tree.expandedKeys).has(this.id))
}

interface EntryData {
  id: string
  type: string
  parentId: string | null
  workspace: string
  root: string
  hasChildren: boolean
  parents: Array<{
    id: string
    path: string
    type: string
  }>
  entries: Array<{
    title: string
    status: EntryStatus
    locale: string | null
    main: boolean
    path: string
    fileHash: string
  }>
}

type SelectedVersion =
  | {type: 'status'; status: EntryStatus}
  | {type: 'history'; ref: string}

export class DashboardEntry {
  workspaceKey: Atom<string>
  rootKey: Atom<string>
  hasChildren: Atom<boolean>
  type: Atom<DashboardType>
  locales: Atom<
    Map<
      string | null,
      {
        title: string
        status: EntryStatus
        locale: string | null
        main: boolean
        path: string
      }
    >
  >
  parentId: Atom<string | null>
  parentIds: Atom<Array<string>>
  root: Atom<DashboardRoot>

  constructor(
    public dashboard: Dashboard,
    public id: string,
    data: Atom<EntryData>
  ) {
    this.workspaceKey = atom(get => get(data).workspace)
    this.rootKey = atom(get => get(data).root)
    this.hasChildren = atom(get => get(data).hasChildren)
    this.type = atom(get => get(this.dashboard.type(get(data).type)))
    this.parentId = atom(get => get(data).parentId)
    this.parentIds = atom(get => get(data).parents.map(parent => parent.id))
    this.locales = atom(
      get =>
        new Map(
          get(data).entries.map(entry => {
            return [entry.locale, entry] as const
          })
        )
    )
    this.root = atom(get =>
      dashboard.workspace(get(this.workspaceKey)).root(get(this.rootKey))
    )
  }

  activeStatus = atom(get => {
    const locales = get(this.locales)
    const locale = get(get(this.root).selectedLocale)
    const entry = locales.get(locale)
    assert(entry, `Entry ${this.id} has no data for locale ${locale}`)
    return entry.status
  })

  #selection = atom<SelectedVersion>()
  selectedVersion = atom(
    (get): SelectedVersion => {
      const current = get(this.#selection)
      if (current) return current
      const status = get(this.activeStatus)
      return {type: 'status', status}
    },
    (get, set, next: SelectedVersion) => {
      startTransition(() => {
        set(this.#selection, next)
      })
    }
  )

  selectedNode = swr(
    atom(async (get): Promise<ReactiveNode<object>> => {
      const version = get(this.selectedVersion)
      if (version.type === 'status') {
        const language = this.languages(get(get(this.root).selectedLocale))
        if (version.status === get(this.activeStatus)) {
          const editing = get(this.currentlyEditing)
          if (editing) return editing
        }
        return get(language.data(version.status))
      }
      throw new Error(`Unsupported version type: ${version.type}`)
    })
  )

  label = atom(get => {
    const locale = get(get(this.root).selectedLocale)
    const locales = get(this.locales)
    const entry = locales.get(locale)
    if (entry?.title) return entry.title
    for (const fallback of locales.values()) {
      if (fallback.title) return fallback.title
    }
    return ''
  })

  parents = atom(async get => {
    const parentIds = get(this.parentIds)
    return Promise.all(parentIds.map(id => get(this.dashboard.entries(id))))
  })

  icon = atom(get => get(this.type).icon)

  children = atom(async get => {
    const root = get(this.root)
    const orderChildrenBy = atom(get => get(this.type).orderChildrenBy)
    return queryTreeChildren(get, root, this.id, orderChildrenBy)
  })

  untranslated = atom(get => {
    const root = get(this.root)
    const locales = get(this.locales)
    const locale = get(root.selectedLocale)
    return !locales.has(locale)
  })

  availableStatuses = atom(async get => {
    const locale = get(get(this.root).selectedLocale)
    const language = this.languages(locale)
    const versions = await get(language.versions)
    return [...versions.keys()]
  })

  activeVersion = atom(async get => {
    const root = get(this.root)
    const locales = get(this.locales)
    const locale = get(root.selectedLocale)
    const entry = locales.get(locale)
    if (entry) return entry
    for (const fallback of locales.values()) {
      if (fallback.title) return fallback
    }
    return null
  })

  languages = dispense((locale: string | null) => {
    return new DashboardEntryLanguage(this, locale)
  })

  routeBlock = atom<{confirm: () => void} | null>(null)

  needsBlock = atom(null, (get, set, confirm: () => void): boolean => {
    const currentNode = get(this.currentlyEditing)
    if (!currentNode) return false
    const isDirty = get(currentNode.isDirty)
    if (isDirty)
      set(this.routeBlock, {
        confirm: () => {
          set(this.routeBlock, null)
          confirm()
        }
      })
    return isDirty
  })

  currentlyEditing = atom<ReactiveNode<object>>()

  saveDraft = atom(null, async (get, set, node: ReactiveNode<object>) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    const data = get(node.value)
    const db = get(this.dashboard.db)
    const type = get(this.type).type
    await db.create({
      type,
      id: this.id,
      locale: locale,
      status: 'draft',
      set: data,
      overwrite: true
    })
    set(node.commit)
  })
}

export class DashboardEntryLanguage {
  constructor(
    public entry: DashboardEntry,
    public locale: string | null
  ) {}

  versions = atom(async get => {
    const db = get(this.entry.dashboard.db)
    get(this.entry.dashboard.revisions(this.entry.id)) // subscribe to entry changes
    const entries = await db.find({
      id: this.entry.id,
      locale: this.locale,
      select: Entry,
      status: 'all'
    })
    // order by draft, published, archived
    const order = ['draft', 'published', 'archived']
    entries.sort((a, b) => {
      return order.indexOf(a.status) - order.indexOf(b.status)
    })
    return new Map(entries.map(entry => [entry.status, entry] as const))
  })

  data = dispense((status: EntryStatus) => {
    return atom(async get => {
      const type = get(this.entry.type).type
      const versions = await get(this.versions)
      const activeStatus = versions.keys().next().value
      const version = versions.get(status)
      assert(version, `No version found`)
      const data = version.data
      // Todo: fix data during indexing instead of here
      const initialValue = {
        ...Type.initialValue(type),
        ...data
      }
      const isActiveVersion = status === activeStatus
      return new ReactiveNode(initialValue, !isActiveVersion)
    })
  })
}

export class DashboardRoot {
  explorer: DashboardExplorer
  constructor(
    public workspace: DashboardWorkspace,
    public key: string
  ) {
    const parentId = atom<string>()
    this.explorer = new DashboardExplorer(
      workspace.dashboard,
      atom(
        get => {
          return {workspace: workspace.key, root: key, parentId: get(parentId)}
        },
        (get, set, update: SetStateAction<ExplorerLocation>) => {
          const next =
            typeof update === 'function'
              ? update(get(this.explorer.location))
              : update
          if (next.root !== key || next.workspace !== workspace.key) {
            set(workspace.dashboard.route, {
              workspace: next.workspace,
              root: next.root
            })
          } else {
            console.log('Updating parentId to', next.parentId)
            set(parentId, next.parentId)
            set(
              workspace.tree.expandedKeys,
              new Set(next.parentId ? [next.parentId] : [])
            )
          }
        }
      ),
      {
        selectionMode: 'multiple',
        selectionBehavior: 'replace',
        onAction: atom(null, (get, set, entry) => {
          if (get(entry.hasChildren)) set(parentId, entry.id)
          else
            set(this.workspace.dashboard.route, {
              workspace: this.workspace.key,
              root: this.key,
              entry: entry.id
            })
        })
      }
    )
  }

  #settings = atom(get => {
    const config = get(this.workspace.dashboard.config)
    const workspaceConfig = config.workspaces[this.workspace.key]
    assert(workspaceConfig)
    const rootConfig = workspaceConfig[this.key]
    return getRoot(rootConfig)
  })

  #languagePreference = atom<string>()
  selectedLocale = atom(
    get => {
      const route = get(this.workspace.dashboard.route)
      const i18n = get(this.i18n)
      if (route.locale && i18n?.locales.includes(route.locale))
        return route.locale
      const preference = get(this.#languagePreference)
      if (preference) return preference
      return i18n?.locales[0] ?? null
    },
    (get, set, locale: string) => {
      const route = get(this.workspace.dashboard.route)
      startTransition(() => {
        set(this.workspace.dashboard.route, {
          workspace: this.workspace.key,
          root: this.key,
          entry: route.entry,
          locale
        })
        set(this.#languagePreference, locale)
      })
    }
  )

  label = atom(get => get(this.#settings).label)
  icon = atom(get => get(this.#settings).icon ?? IcRoundDescription)
  i18n = atom(get => get(this.#settings).i18n)
  view = atom(get => get(this.#settings).view)
  orderChildrenBy = atom(get => get(this.#settings).orderChildrenBy)
  children = atom(get =>
    queryTreeChildren(get, this, null, this.orderChildrenBy)
  )
  isMedia = atom(get => get(this.#settings).isMediaRoot)

  hasChildren = atom(async get => {
    const db = get(this.workspace.dashboard.db)
    const visibleTypes = get(this.workspace.tree.visibleTypes)
    return Boolean(
      await db.first({
        workspace: this.workspace.key,
        root: this.key,
        parentId: null,
        filter: {_type: {in: visibleTypes}},
        status: 'preferDraft'
      })
    )
  })
}

async function queryTreeChildren(
  get: Getter,
  root: DashboardRoot,
  parentId: null | string,
  orderByAtom: Atom<Order | Array<Order> | undefined>
) {
  get(root.workspace.dashboard.sha) // subscribe to content changes
  const visibleTypes = get(root.workspace.tree.visibleTypes)
  const db = get(root.workspace.dashboard.db)
  const orderBy = get(orderByAtom)
  const locale = get(root.selectedLocale)
  const children = await db.find({
    select: {
      id: Entry.id,
      locale: Entry.locale
    },
    orderBy,
    workspace: root.workspace.key,
    root: root.key,
    parentId: parentId,
    filter: {
      _type: {in: visibleTypes}
    },
    status: 'preferDraft'
  })
  const translatedChildren = new Set(
    children.filter(child => child.locale === locale).map(child => child.id)
  )
  const untranslated = new Set()
  const orderedChildren = children.filter(child => {
    if (translatedChildren.has(child.id)) return child.locale === locale
    if (untranslated.has(child.id)) return false
    untranslated.add(child.id)
    return true
  })
  const ids = [...new Set(orderedChildren.map(child => child.id))]
  return ids
}

type Result<Value> = [value: Value, error: null] | [value: null, error: Error]
type BatchLoadFn<V> = (
  keys: ReadonlyArray<string>
) => Promise<ReadonlyArray<Result<V>>>
function loader<Value>(fn: BatchLoadFn<Value>) {
  let batch: {key: string; resolve: (v: Result<Value>) => void}[] = []
  return (key: string): Promise<Result<Value>> => {
    return new Promise(resolve => {
      if (batch.push({key, resolve}) === 1) {
        queueMicrotask(async () => {
          const current = batch
          batch = []
          try {
            const result = await fn(current.map(i => i.key))
            for (const [index, item] of current.entries())
              item.resolve(
                result[index] ?? [
                  null,
                  new Error(`Missing result for ${item.key}`)
                ]
              )
          } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e))
            for (const item of current) item.resolve([null, err])
          }
        })
      }
    })
  }
}

function dispense<Key = string, Value = unknown>(
  fn: (key: Key) => Value
): (key: Key) => Value {
  const values = new Map<Key, Value>()
  return function dispenseValue(key: Key) {
    if (!values.has(key)) values.set(key, fn(key))
    return values.get(key)!
  }
}

const DASHBOARD_ENTRY_DRAG_TYPE = 'application/x-alinea-entry-id'

function dragItem(id: Key): DragItem {
  const key = String(id)
  return {
    'text/plain': key,
    [DASHBOARD_ENTRY_DRAG_TYPE]: key
  }
}

function swr<Value>(asyncAtom: Atom<Promise<Value>>) {
  const withPrev = unwrap(asyncAtom, prev => prev)
  return atom(get => {
    const current = get(withPrev)
    return current ?? get(asyncAtom)
  })
}

function atomWithPending<Value>(asyncAtom: Atom<Promise<Value> | Value>) {
  const wrappedAtom = atom(async get => {
    const data = await get(asyncAtom)
    return [false, data] as const
  })
  return unwrap(wrappedAtom, prev => [true, prev?.[1]] as const)
}

// data nodes

export type Writable<Value> = WritableAtom<Value, [SetStateAction<Value>], void>

function isArray<Value = any>(input: unknown): input is Array<Value> {
  return Array.isArray(input)
}
function isObject<Value extends object>(input: unknown): input is Value {
  return input !== null && typeof input === 'object' && !isArray(input)
}
type ReactiveObject = Record<string, ReactiveNode>

export class ReactiveNode<Value = unknown> {
  #initialValue: Value
  readonly readOnly: boolean
  nodes: WritableAtom<unknown, [unknown], void>
  #inner = atom(get => {
    const nodes = get(this.nodes)
    if (isArray<ReactiveNode>(nodes)) return nodes
    if (isObject<ReactiveObject>(nodes)) return values(nodes)
    return []
  })
  value: Writable<Value>

  constructor(initialValue: Value, readOnly = false) {
    this.#initialValue = initialValue
    this.readOnly = readOnly
    this.nodes = atom(this.#wrap(initialValue))
    this.value = atom(this.#read, this.#write)
  }

  #read = (get: Getter) => {
    return this.#unwrap(get, get(this.nodes)) as Value
  }

  #write = (get: Getter, set: Setter, update: SetStateAction<Value>) => {
    if (this.readOnly) return
    const next =
      typeof update === 'function'
        ? (update as Function)(get(this.value))
        : update
    this.#reconcile(get, set, next)
    const isChanged = next === this.#initialValue
    set(this.#dirty, !isChanged)
  }

  isEmpty = atom(get => get(this.value) === undefined)
  #dirty = atom(false)
  isDirty = atom(
    (get): boolean => {
      const dirty = get(this.#dirty)
      if (dirty) return true
      return get(this.#inner).some(node => get(node.isDirty))
    },
    (get, set, value: false) => {
      const isDirty = get(this.isDirty)
      if (!isDirty) return
      set(this.#dirty, false)
      for (const node of get(this.#inner)) set(node.isDirty, false)
    }
  )

  #wrap(value: unknown): unknown {
    if (isArray(value))
      return value.map(i => new ReactiveNode(i, this.readOnly))
    if (isObject(value)) {
      return fromEntries(
        entries(value).map(([k, i]) => [k, new ReactiveNode(i, this.readOnly)])
      )
    }
    return value
  }

  #unwrap(get: Getter, nodes: unknown): unknown {
    if (isArray<ReactiveNode>(nodes)) return nodes.map(node => get(node.value))
    if (isObject<ReactiveObject>(nodes)) {
      return fromEntries(entries(nodes).map(([k, n]) => [k, get(n.value)]))
    }
    return nodes
  }

  #reconcile(get: Getter, set: Setter, next: unknown) {
    const curr = get(this.nodes)

    if (isArray(next) && isArray(curr)) {
      let changed = curr.length !== next.length
      const nextStruct = []
      for (let i = 0; i < next.length; i++) {
        const val = next[i]
        if (curr[i]) {
          set((curr[i] as ReactiveNode).value, val)
          nextStruct.push(curr[i])
        } else {
          changed = true
          nextStruct.push(new ReactiveNode(val, this.readOnly))
        }
      }
      if (changed) set(this.nodes, nextStruct)
    } else if (isObject<any>(next) && isObject<any>(curr)) {
      let changed = false
      const nextStruct = {...curr} as Record<string, ReactiveNode>
      for (const key of Object.keys(curr)) {
        if (!(key in next)) {
          delete nextStruct[key]
          changed = true
        } else {
          set((curr[key] as ReactiveNode).value, next[key])
        }
      }
      for (const key of Object.keys(next)) {
        if (!curr[key]) {
          changed = true
          nextStruct[key] = new ReactiveNode(next[key], this.readOnly)
        }
      }
      if (changed) set(this.nodes, nextStruct)
    } else if (curr !== next) {
      set(this.nodes, this.#wrap(next))
    }
  }

  reset = atom(null, (get, set): void => {
    set(this.value, this.#initialValue)
    set(this.isDirty, false)
  })

  commit = atom(null, (get, set): Value => {
    for (const node of get(this.#inner)) set(node.commit)
    this.#initialValue = get(this.value)
    set(this.#dirty, false)
    return this.#initialValue
  })

  field = dispense((key: string): Writable<unknown> => {
    return atom(
      get => {
        const structure = get(this.nodes)
        return isObject<any>(structure) && structure[key]
          ? get((structure[key] as ReactiveNode).value)
          : undefined
      },
      (get, set, update) => {
        const structure = get(this.nodes)
        if (isObject<any>(structure) && structure[key])
          set((structure[key] as ReactiveNode).value, update)
      }
    )
  })

  push = atom(null, (get, set, val: unknown) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    set(this.nodes, [...structure, new ReactiveNode(val, this.readOnly)])
    set(this.#dirty, true)
  })

  remove = atom(null, (get, set, i: number) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    set(
      this.nodes,
      structure.filter((_, idx) => idx !== i)
    )
    set(this.#dirty, true)
  })

  move = atom(null, (get, set, from: number, to: number) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    const next = [...structure]
    next.splice(to, 0, next.splice(from, 1)[0])
    set(this.nodes, next)
    set(this.#dirty, true)
  })
}
