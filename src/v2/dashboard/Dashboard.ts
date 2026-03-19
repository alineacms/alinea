import {DragItem} from '@react-types/shared'
import type {Config} from 'alinea/core/Config'
import type {LocalConnection} from 'alinea/core/Connection'
import {IndexEvent} from 'alinea/core/db/IndexEvent'
import type {LocalDB} from 'alinea/core/db/LocalDB'
import {Entry, EntryStatus} from 'alinea/core/Entry'
import {Field} from 'alinea/core/Field'
import type {Order} from 'alinea/core/Graph'
import {getRoot, getType, getWorkspace} from 'alinea/core/Internal'
import {Section} from 'alinea/core/Section.js'
import {FieldGetter, optionTrackerOf} from 'alinea/core/Tracker'
import {Type} from 'alinea/core/Type'
import {assert} from 'alinea/core/util/Assert'
import {entries} from 'alinea/core/util/Objects.js'
import {parents, translations} from 'alinea/query'
import type {Atom, Getter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {atomWithLocation} from 'jotai-location'
import {startTransition, type ComponentType} from 'react'
import type {DroppableCollectionReorderEvent, Key} from 'react-aria-components'
import {
  IcRoundDescription,
  IcTwotoneDescription,
  IcTwotoneFolder
} from '../icons.js'

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

  workspaces = atom(get => {
    const config = get(this.config)
    return Object.keys(config.workspaces)
  })

  workspace = dispense(key => new DashboardWorkspace(this, key))

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

type Writable<Value> = WritableAtom<Value, [Value], void>

export interface Node<Value = unknown> {
  value: Writable<Value>
  accepts(value: unknown): value is Value
}

export class Primitive<Value> implements Node<Value> {
  value: Writable<Value>
  constructor(initialValue: Value) {
    this.value = atom(initialValue)
  }
  accepts(value: unknown): value is Value {
    return typeof value !== 'object' || value === null
  }
}

export class ObjectNode<Value extends object> implements Node<Value> {
  nodes: Writable<Map<string, Node>>
  constructor(initialValue: Value) {
    this.nodes = atom(
      new Map<string, Node>(
        entries(initialValue).map(([key, value]) => {
          return [key, createNode(value)]
        })
      )
    )
  }
  value = atom(
    get => {
      const result: Record<string, unknown> = {}
      const fields = get(this.nodes)
      for (const [key, node] of fields) result[key] = get(node.value)
      return result as Value
    },
    (get, set, update: Value) => {
      const updates = Array<[string, Node]>()
      const removes = Array<string>()
      const fields = get(this.nodes)
      for (const [key, value] of entries(update)) {
        const node = fields.get(key)
        if (node && node.accepts(value)) set(node.value, value)
        else updates.push([key, createNode(value)])
      }
      for (const key of fields.keys()) {
        if (!(key in update)) removes.push(key)
      }
      if (updates.length > 0 || removes.length > 0) {
        const next = new Map(fields)
        for (const [key, node] of updates) next.set(key, node)
        for (const key of removes) next.delete(key)
        set(this.nodes, next)
      }
    }
  )
  accepts(value: unknown): value is Value {
    return typeof value === 'object' && value !== null
  }
}

export class ArrayNode<Value> implements Node<Array<Value>> {
  nodes: Writable<Array<Node<Value>>>
  constructor(initialValue: Array<Value>) {
    this.nodes = atom(initialValue.map(createNode))
  }
  value = atom(
    get => {
      return get(this.nodes).map(node => get(node.value)) as Array<Value>
    },
    (get, set, update: Array<Value>) => {
      const current = get(this.nodes)
      const next = update.map((value, index) => {
        const node = current[index]
        if (node && node.accepts(value)) {
          set(node.value, value)
          return node
        }
        return createNode(value)
      })
      if (next.length !== current.length) set(this.nodes, next)
    }
  )
  accepts(value: unknown): value is Array<Value> {
    return Array.isArray(value)
  }
}

export function createNode<Value>(value: Value): Node<Value> {
  if (!value) return new Primitive(value)
  if (Array.isArray(value)) return <any>new ArrayNode(value)
  if (typeof value === 'object') return <any>new ObjectNode(value)
  return <any>new Primitive(value)
}

export class DashboardEditor {
  container: ObjectContainer
  sections: Array<DashboardSection>
  constructor(
    public dashboard: Dashboard,
    public type: Type,
    initialValue: Record<string, unknown>
  ) {
    this.container = new ObjectContainer(initialValue)
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

export class DashboardField {
  value: WritableAtom<unknown, [unknown], void>

  constructor(
    public draft: DashboardEditor,
    public key: string,
    public field: Field
  ) {
    this.value = draft.container.scalar[this.key]
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

  error = atom(get => {
    const options = get(this.options)
    const value = get(this.value)
    if (options.validate) {
      const result = options.validate(value)
      if (typeof result === 'boolean') return result ? undefined : true
      return result
    }
    if (options.required) {
      if (value === undefined || value === null) return true
      if (typeof value === 'string' && value === '') return true
      if (Array.isArray(value) && value.length === 0) return true
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
      }
    ),
    {onMount: (setSelf: (value: 'init') => void) => setSelf('init')}
  )
  #expandedKeys = atom(new Set<Key>())

  selectedKeys = atom(
    get => get(this.#treeSelection),
    (get, set, next: 'all' | Set<Key>) => {
      assert(next !== 'all', 'Selecting all items is not supported')
      const [first] = next
      if (first) {
        const expandedKeys = get(this.#expandedKeys)
        if (!expandedKeys.has(first))
          set(this.#expandedKeys, new Set(expandedKeys).add(first))
      }
      set(this.#treeSelection, next)
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
          entry.hasChildren
        )
      })
    }
  )

  rootItems: Record<string, DashboardTreeItem> = dispense(key => {
    const root = this.workspace.root[key]
    return new DashboardTreeItem(
      this,
      `${ROOT_KEY_PREFIX}${root.key}`,
      root.icon,
      root.label,
      atom(async get => {
        const ids = await get(root.children)
        return Promise.all(ids.map(id => this.entryItems[id]).map(get))
      }),
      root.hasChildren
    )
  })

  items = atom(get => {
    const roots = get(this.workspace.roots)
    return roots.map(key => this.rootItems[key])
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
  constructor(
    public tree: DashboardTree,
    public id: string,
    public icon: Atom<Awaitable<ComponentType | undefined>>,
    public label: Atom<string>,
    public items: Atom<Awaitable<Array<DashboardTreeItem>>>,
    public hasChildren: Atom<Awaitable<boolean>>
  ) {}

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

  icon = atom(async get => {
    const typeIcon = get(this.type).icon
    if (typeIcon) return typeIcon
    const hasChildren = await get(this.hasChildren)
    return hasChildren ? IcTwotoneFolder : IcTwotoneDescription
  })

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
    console.log('here')
    const locale = get(this.#root.selectedLocale)
    const type = get(this.type).type
    const db = get(this.dashboard.db)
    const data = await db.get({
      id: this.id,
      locale,
      select: Entry.data,
      status: 'preferDraft'
    })
    return new DashboardEditor(this.dashboard, type, data)
  })
}

export class DashboardRoot {
  constructor(
    public workspace: DashboardWorkspace,
    public key: string
  ) {}

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
      type: Entry.type,
      parents: Entry.parents,
      locale: Entry.locale,
      root: Entry.root,
      workspace: Entry.workspace
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
