import {DragItem} from '@react-types/shared'
import type {Config} from 'alinea/core/Config'
import type {LocalConnection} from 'alinea/core/Connection'
import {IndexEvent} from 'alinea/core/db/IndexEvent'
import type {LocalDB} from 'alinea/core/db/LocalDB'
import {Entry, EntryStatus} from 'alinea/core/Entry'
import {Field, FieldOptions} from 'alinea/core/Field'
import type {Order} from 'alinea/core/Graph'
import {getRoot, getType, getWorkspace} from 'alinea/core/Internal'
import {Section} from 'alinea/core/Section.js'
import {FieldGetter, optionTrackerOf} from 'alinea/core/Tracker'
import {Type} from 'alinea/core/Type'
import {assert} from 'alinea/core/util/Assert'
import {entries, fromEntries, keys} from 'alinea/core/util/Objects'
import {parents, translations} from 'alinea/query'
import type {Atom, Getter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {atomWithLocation} from 'jotai-location'
import {loadable, unwrap} from 'jotai/utils'
import {SetStateAction, startTransition, type ComponentType} from 'react'
import type {DroppableCollectionReorderEvent, Key} from 'react-aria-components'
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
  db: Atom<LocalDB>

  constructor(
    dbAtom: Atom<LocalDB>,
    public config: Atom<Config>,
    public client: Atom<LocalConnection>,
    public views: Atom<Record<string, ComponentType>> = atom({})
  ) {
    this.db = Object.assign(
      atom(
        get => get(dbAtom),
        (get, set) => {
          const db = get(dbAtom)
          // Listen to db changes and update entry revisions
          const listen = (event: Event) => {
            if (event instanceof IndexEvent && event.data.op === 'entry') {
              console.log('Entry updated', event.data.id)
              set(this.revisions[event.data.id], current => current + 1)
            }
          }
          db.index.addEventListener(IndexEvent.type, listen)
          return () => {
            db.index.removeEventListener(IndexEvent.type, listen)
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

  #location = atomWithLocation()
  route = atom(
    get => {
      const {pathname = '/', searchParams = new URLSearchParams()} = get(
        this.#location
      )
      const [workspace, root, entry] = pathname.split('/').slice(1) as Array<
        string | undefined
      >
      const locale = searchParams.get('locale') ?? undefined
      return {
        workspace,
        root,
        entry,
        locale
      }
    },
    (get, set, update: DashboardRoute) => {
      let {workspace, root, entry, locale} = update
      const pathname = `/${[workspace, root, entry].filter(Boolean).join('/')}`
      const searchParams = new URLSearchParams()
      if (locale) searchParams.set('locale', locale)
      startTransition(() => {
        set(this.#location, {pathname, searchParams})
      })
    }
  )

  explorerLocation = atom(
    get => {
      const workspace = get(this.selectedWorkspace)
      const root = get(this.selectedRoot)
      return {workspace, root}
    },
    (get, set, update: ExplorerLocation) => {
      set(this.route, update)
    }
  )

  focused = atom(async (get): Promise<FocusedItem> => {
    const route = get(this.route)
    if (route.entry) return {entry: await get(this.entries[route.entry])}
    if (!route.workspace) return null
    const workspace = this.workspace[route.workspace!]
    if (route.root) return {root: workspace.root[route.root]}
    return null
  })

  #sha = atom<string>()
  sha = Object.assign(
    atom(
      get => get(this.#sha) ?? get(this.db).sha,
      (get, set) => {
        const db = get(this.db)
        const listen = (event: Event) => {
          if (event instanceof IndexEvent && event.data.op === 'index')
            set(this.#sha, event.data.sha)
        }
        db.index.addEventListener(IndexEvent.type, listen)
        return () => {
          db.index.removeEventListener(IndexEvent.type, listen)
        }
      }
    ),
    {onMount: (init: () => void) => init()}
  )

  selectedWorkspace = atom(
    get => {
      const {workspace} = get(this.route)
      if (workspace) return workspace
      const config = get(this.config)
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
      label: get(this.workspace[workspace].label),
      icon: get(this.workspace[workspace].icon)
    }))
  })

  currentWorkspace = atom(get => {
    const workspaceKey = get(this.selectedWorkspace)
    return this.workspace[workspaceKey]
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

  explore(initialLocation: ExplorerLocation) {
    return new DashboardExplorer(this, atom(initialLocation))
  }

  entries = dispense(id => {
    return atom(async get => {
      const load = get(this.#entryLoader)
      const [result, error] = await load(id)
      if (error) throw error
      get(this.revisions[id])
      return new DashboardEntry(this, result)
    })
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
      const byId = new Map(rows.map(row => [row.id, row] as const))
      return ids.map(id => {
        const row = byId.get(id)
        if (!row) return [null, new Error(`Missing entry ${id}`)] as const
        return [row, null] as const
      })
    })
  })
}

export class DashboardEditor {
  value: Atom<object>
  sections: Array<DashboardSection>
  constructor(
    public dashboard: Dashboard,
    public type: Type,
    public node: ObjectNode
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
    return this.field[key]
  }
}

export class DashboardSection {
  constructor(
    public dashboard: Dashboard,
    public section: Section
  ) {}

  view = atom(get => {
    const view = Section.view(this.section)
    if (typeof view === 'string') return get(this.dashboard.view[view])
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

type ExplorerLocationAtom = WritableAtom<
  ExplorerLocation,
  [ExplorerLocation],
  void
>

export class DashboardExplorer {
  constructor(
    public dashboard: Dashboard,
    public location: ExplorerLocationAtom
  ) {}

  search = atom('')
  view = atom<'card' | 'row'>('card')
  selection = atom<'all' | Set<Key>>(new Set<Key>())

  workspace = atom(
    get => {
      const {workspace} = get(this.location)
      return this.dashboard.workspace[workspace]
    },
    (get, set, update: string) => {
      set(this.location, {workspace: update})
    }
  )

  root = atom(
    get => {
      const {root} = get(this.location)
      if (!root) return
      const workspace = get(this.workspace)
      return workspace.root[root]
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
      return get(this.dashboard.entries[parentId])
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
        parentId: location.parentId,
        select: Entry.id,
        status: 'preferDraft'
      })
      return Promise.all(
        children.map(id => this.dashboard.entries[id]).map(get)
      )
    })
  )

  parentsMenu = unwrap(
    atom(async get => {
      const {parentId} = get(this.location)
      if (!parentId) return []
      const parent = await get(this.dashboard.entries[parentId])
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
    this.value = this.draft.node.field[key]
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
    if (typeof view === 'string') return get(this.draft.dashboard.view[view])
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
      const {root, workspace} = await get(this.dashboard.entries[selectedId])
      set(this.dashboard.route, {
        workspace: workspace,
        root: root,
        entry: selectedId,
        locale: current.locale
      })
    }
  )

  tree = new DashboardTree(this, this.#treeSelection)

  #settings = atom(get => {
    const config = get(this.dashboard.config)
    const workspaceConfig = config.workspaces[this.key]
    assert(workspaceConfig)
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
      label: get(this.root[root].label),
      icon: get(this.root[root].icon)
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
    const {parentIds} = await get(this.workspace.dashboard.entries[route.entry])
    const keys = new Set<Key>(parentIds)
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

  currentRoot = atom(get => {
    const [selectedKey] = get(this.selectedKeys)
    let rootKey: string | undefined
    if (selectedKey) {
      const selectedId = String(selectedKey)
      if (selectedId.startsWith(ROOT_KEY_PREFIX))
        rootKey = selectedId.slice(ROOT_KEY_PREFIX.length)
    }
    rootKey ??= get(this.workspace.dashboard.route).root
    rootKey ??= get(this.workspace.roots)[0]
    if (!rootKey) return null
    return this.workspace.root[rootKey]
  })

  entryItems: Record<string, Atom<Promise<DashboardTreeItem>>> = dispense(
    id => {
      return atom(async get => {
        const entry = await get(this.workspace.dashboard.entries[id])
        const hasChildren = await get(entry.hasChildren)
        return new DashboardTreeItem(
          this,
          id,
          entry.icon,
          entry.label,
          atom(async get => {
            const children = await get(entry.children)
            for (const childId of children) get(this.entryItems[childId])
            return Promise.all(
              children.map(childId => this.entryItems[childId]).map(get)
            )
          }),
          hasChildren
        )
      })
    }
  )

  rootItems: Record<string, Atom<Promise<DashboardTreeItem>>> = dispense(
    key => {
      return atom(async get => {
        const root = this.workspace.root[key]
        const hasChildren = await get(root.hasChildren)
        return new DashboardTreeItem(
          this,
          `${ROOT_KEY_PREFIX}${root.key}`,
          root.icon,
          root.label,
          atom(async get => {
            const ids = await get(root.children)
            return Promise.all(ids.map(id => this.entryItems[id]).map(get))
          }),
          hasChildren
        )
      })
    }
  )

  items = atom(get => {
    const roots = get(this.workspace.roots)
    return Promise.all(roots.map(key => this.rootItems[key]).map(get))
  })

  // dnd
  getItems = atom(null, (get, set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(id => {
      return {'text/plain': String(id)}
    })
  })

  onMove = atom(
    null,
    async (get, set, event: DroppableCollectionReorderEvent) => {
      const db = get(this.workspace.dashboard.db)
      const {keys, target} = event
      const [dragged] = keys
      if (!dragged) return
      const draggedId = String(dragged)
      if (draggedId.startsWith(ROOT_KEY_PREFIX)) return
      const targetId = String(target.key)
      await db.move({
        id: draggedId,
        target: targetId.startsWith(ROOT_KEY_PREFIX)
          ? targetId.slice(ROOT_KEY_PREFIX.length)
          : targetId,
        targetType: targetId.startsWith(ROOT_KEY_PREFIX) ? 'root' : 'entry',
        dropPosition: target.dropPosition
      })
    }
  )

  visibleTypes = atom(get => {
    const config = get(this.workspace.dashboard.config)
    return Object.entries(config.schema)
      .filter(([, type]) => !Type.isHidden(type))
      .map(([name]) => name)
  })
}

type Awaitable<T> = T | Promise<T>

export class DashboardTreeItem {
  items: Atom<Array<DashboardTreeItem>>
  constructor(
    public tree: DashboardTree,
    public id: string,
    public icon: Atom<ComponentType | undefined>,
    public label: Atom<string>,
    items: Atom<Awaitable<Array<DashboardTreeItem>>>,
    public hasChildren: boolean
  ) {
    this.items = unwrap(items, prev => prev ?? [])
  }

  isExpanded = atom(get => get(this.tree.expandedKeys).has(this.id))
}

interface EntryData {
  id: string
  type: string
  parentId: string | null
  workspace: string
  root: string
  parents: {
    id: string
    path: string
    type: string
  }[]
  entries: {
    title: string
    status: EntryStatus
    locale: string | null
    main: boolean
    path: string
    fileHash: string
  }[]
}

export class DashboardEntry {
  id: string
  workspace: string
  root: string
  type: Atom<DashboardType>
  locales: Map<
    string | null,
    {
      title: string
      status: EntryStatus
      locale: string | null
      main: boolean
      path: string
    }
  >
  parentId: string | null
  parentIds: Array<string>
  #workspace: DashboardWorkspace
  #root: DashboardRoot

  constructor(
    public dashboard: Dashboard,
    data: EntryData
  ) {
    this.id = data.id
    this.workspace = data.workspace
    this.root = data.root
    this.type = dashboard.type[data.type]
    this.parentId = data.parentId
    this.parentIds = data.parents.map(p => p.id)
    this.locales = new Map(
      data.entries.map(entry => {
        return [entry.locale, entry] as const
      })
    )
    this.#workspace = dashboard.workspace[this.workspace]
    this.#root = this.#workspace.root[this.root]
  }

  label = atom(get => {
    const locale = get(this.#root.selectedLocale)
    const entry = this.locales.get(locale)
    if (entry?.title) return entry.title
    for (const fallback of this.locales.values()) {
      if (fallback.title) return fallback.title
    }
    return ''
  })

  parents = atom(async get => {
    return Promise.all(
      this.parentIds.map(id => get(this.dashboard.entries[id]))
    )
  })

  icon = atom(get => get(this.type).icon)

  children = atom(async get => {
    const orderChildrenBy = atom(get => get(this.type).orderChildrenBy)
    return queryTreeChildren(get, this.#root, this.id, orderChildrenBy)
  })

  hasChildren = atom(async get => {
    const db = get(this.dashboard.db)
    const visibleTypes = get(this.#root.workspace.tree.visibleTypes)
    return Boolean(
      await db.first({
        workspace: this.#workspace.key,
        root: this.#root.key,
        parentId: this.id,
        filter: {_type: {in: visibleTypes}},
        status: 'preferDraft'
      })
    )
  })

  untranslated = atom(get => {
    const locale = get(this.#root.selectedLocale)
    return !this.locales.has(locale)
  })

  activeVersion = atom(get => {
    const locale = get(this.#root.selectedLocale)
    const entry = this.locales.get(locale)
    if (entry) return entry
    for (const fallback of this.locales.values()) {
      if (fallback.title) return fallback
    }
    return null
  })

  editor = atom(async get => {
    const locale = get(this.#root.selectedLocale)
    const type = get(this.type).type
    const db = get(this.dashboard.db)
    const data = await db.get({
      id: this.id,
      locale,
      select: Entry.data,
      status: 'preferDraft'
    })
    // Todo: fix data during indexing instead of here
    const initialValue = {
      ...Type.initialValue(type),
      ...data
    }
    console.log(initialValue)
    const node = createObjectNode(initialValue)
    return new DashboardEditor(this.dashboard, type, node)
  })
}

export class DashboardRoot {
  explorer: DashboardExplorer
  constructor(
    public workspace: DashboardWorkspace,
    public key: string
  ) {
    this.explorer = new DashboardExplorer(
      workspace.dashboard,
      workspace.dashboard.explorerLocation
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
      set(this.workspace.dashboard.route, {
        workspace: this.workspace.key,
        root: this.key,
        entry: route.entry,
        locale
      })
      set(this.#languagePreference, locale)
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

function dispense<T>(fn: (key: string) => T): Record<string, T> {
  return new Proxy(Object.create(null), {
    get(target: Record<string | symbol, T>, key: string | symbol) {
      if (!(typeof key === 'string')) return target[key]
      if (!(key in target)) target[key] = fn(key)
      return target[key]
    }
  })
}

// data nodes

function resolveSetStateAction<Value>(
  current: Value,
  update: SetStateAction<Value>
): Value {
  if (typeof update === 'function') {
    return (update as (current: Value) => Value)(current)
  }
  return update
}

type Writable<Value> = WritableAtom<Value, [SetStateAction<Value>], void>

export interface Node<Value = unknown> {
  value: Writable<Value>
  accepts(value: unknown): value is Value
}

function isArray<Value>(value: unknown): value is Array<Value> {
  return Array.isArray(value)
}

function isObject<Value extends object>(value: unknown): value is Value {
  return value !== null && typeof value === 'object' && !isArray(value)
}

function isScalar<Value>(value: unknown): value is Value {
  return !isObject(value) && !isArray(value)
}

export class ScalarNode<Value> implements Node<Value> {
  value: Writable<Value>
  accepts = isScalar
  constructor(initialValue: Value) {
    const current = atom(initialValue)
    this.value = atom(
      get => get(current),
      (get, set, update: SetStateAction<Value>) => {
        const next = resolveSetStateAction(get(current), update)
        set(current, next)
      }
    )
  }
}

export class ObjectNode<Value extends object = object> implements Node<Value> {
  nodes: Writable<Record<string, Node>>
  accepts = isObject
  constructor(initialValue: Value) {
    this.nodes = atom(
      fromEntries(
        entries(initialValue).map(([key, value]) => {
          return [key, createNode(value)]
        })
      )
    )
  }
  field = dispense(key => {
    return atom(
      get => {
        const nodes = get(this.nodes)
        const node = nodes[key]
        assert(node, `Field not found`)
        return get(node.value)
      },
      (get, set, update: SetStateAction<unknown>) => {
        const nodes = get(this.nodes)
        const node = nodes[key]
        assert(node, `Field not found`)
        const next = resolveSetStateAction(get(node.value), update)
        assert(node.accepts(next), `Invalid value for field`)
        set(node.value, next)
      }
    )
  })
  value = atom(
    get => {
      return fromEntries(
        entries(get(this.nodes)).map(([key, node]) => {
          return [key, get(node.value)]
        })
      ) as Value
    },
    (get, set, update: SetStateAction<Value>) => {
      const nextValue = resolveSetStateAction(get(this.value), update)
      const updates = Array<[string, Node]>()
      const removes = Array<string>()
      const fields = get(this.nodes)
      for (const [key, value] of entries(nextValue)) {
        const node = fields[key]
        if (node && node.accepts(value)) set(node.value, value)
        else updates.push([key, createNode(value)])
      }
      for (const key of keys(fields)) {
        if (!(key in nextValue)) removes.push(key)
      }
      if (updates.length > 0 || removes.length > 0) {
        const next = {...fields}
        for (const [key, node] of updates) next[key] = node
        for (const key of removes) delete next[key]
        set(this.nodes, next)
      }
    }
  )
}

export class ArrayNode<Value = Array<unknown>> implements Node<Array<Value>> {
  nodes: Writable<Array<Node<Value>>>
  accepts = isArray
  constructor(initialValue: Array<Value>) {
    this.nodes = atom(initialValue.map(createNode))
  }
  value = atom(
    get => {
      return get(this.nodes).map(node => get(node.value)) as Array<Value>
    },
    (get, set, update: SetStateAction<Array<Value>>) => {
      const nextValue = resolveSetStateAction(get(this.value), update)
      const current = get(this.nodes)
      let changed = current.length !== nextValue.length
      const next = nextValue.map((value, index) => {
        const node = current[index]
        if (node && node.accepts(value)) {
          set(node.value, value)
          return node
        }
        changed = true
        return createNode(value)
      })
      if (changed) set(this.nodes, next)
    }
  )
  push = atom(null, (get, set, value: Value) => {
    set(this.nodes, [...get(this.nodes), createNode(value)])
  })
  move = atom(null, (get, set, from: number, to: number) => {
    const current = get(this.nodes)
    const next = [...current]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    set(this.nodes, next)
  })
  remove = atom(null, (get, set, index: number) => {
    const current = get(this.nodes)
    const next = [...current]
    next.splice(index, 1)
    set(this.nodes, next)
  })
}

export function createObjectNode<Value extends Object>(
  initialValue: Value
): ObjectNode<Value> {
  return new ObjectNode(initialValue)
}

export function createArrayNode<Value>(
  initialValue: Array<Value>
): ArrayNode<Value> {
  return new ArrayNode(initialValue)
}

export function createNode<Value>(initialValue: Value): Node<Value> {
  if (isArray(initialValue)) return createArrayNode(initialValue) as any
  if (isObject(initialValue)) return createObjectNode(initialValue) as any
  return new ScalarNode(initialValue)
}

export function atomWithPending<T>(
  baseAtom: Atom<T>
): Atom<[isPending: boolean, current: Awaited<T> | undefined]> {
  const unwrappedAtom = unwrap(baseAtom, prev => prev)
  const loadableAtom = loadable(baseAtom)
  return atom(get => {
    const status = get(loadableAtom)
    const current = get(unwrappedAtom)
    return [status.state === 'loading', current as Awaited<T> | undefined]
  })
}
