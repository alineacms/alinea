import type {Config} from 'alinea/core/Config'
import type {LocalConnection} from 'alinea/core/Connection'
import type {LocalDB} from 'alinea/core/db/LocalDB'
import {Entry} from 'alinea/core/Entry'
import type {Order} from 'alinea/core/Graph'
import {getRoot, getType, getWorkspace} from 'alinea/core/Internal'
import {Type} from 'alinea/core/Type'
import {assert} from 'alinea/core/util/Assert'
import {parents, translations} from 'alinea/query'
import type {Atom, Getter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {atomWithLocation} from 'jotai-location'
import type {ComponentType} from 'react'
import type {Key} from 'react-aria-components'

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

export class Dashboard {
  constructor(
    public db: Atom<LocalDB>,
    public config: Atom<Config>,
    public client: Atom<LocalConnection>
  ) {}

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
      const current = get(this.route)
      let {workspace, root, entry, locale} = update
      if (locale) entry = entry ?? current.entry
      if (entry) root = root ?? current.root
      if (root) workspace = workspace ?? current.workspace
      const pathname = `/${[workspace, root, entry].filter(Boolean).join('/')}`
      const searchParams = new URLSearchParams()
      if (locale) searchParams.set('locale', locale)
      set(this.#location, {pathname, searchParams})
    }
  )

  sha = atom(get => get(this.db).sha)

  selectedWorkspace = atom(
    get => {
      const {workspace} = get(this.route)
      if (workspace) return workspace
      const config = get(this.config)
      const workspaceKeys = Object.keys(config.workspaces)
      return workspaceKeys[0] ?? null
    },
    (get, set, workspace: string) => {
      set(this.route, {workspace})
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

  entries = dispense(id => new DashboardEntry(this, id))

  entryLoader = atom(get => {
    const db = get(this.db)
    return loader(async ids => {
      const data = {
        id: Entry.id,
        type: Entry.type,
        title: Entry.title,
        status: Entry.status,
        locale: Entry.locale,
        workspace: Entry.workspace,
        main: Entry.main,
        root: Entry.root,
        path: Entry.path,
        parents: parents({
          select: {
            id: Entry.id,
            path: Entry.path,
            type: Entry.type
          }
        })
      }
      const rows = await db.find({
        groupBy: Entry.id,
        select: {
          id: Entry.id,
          type: Entry.type,
          parentId: Entry.parentId,
          workspace: Entry.workspace,
          root: Entry.root,
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
      const root = await get(this.dashboard.entries[selectedId].root)
      set(this.dashboard.route, {
        workspace: root.workspace.key,
        root: root.key,
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

  focusItem = atom<DashboardTreeItem>()
  expandedKeys = atom(new Set<Key>())
  selectedKeys = atom(
    get => get(this.#treeSelection),
    (get, set, next: 'all' | Set<Key>) => {
      assert(next !== 'all', 'Selecting all items is not supported')
      const [first] = next
      // Add to expanded keys if not already expanded
      if (first) {
        const expandedKeys = get(this.expandedKeys)
        if (!expandedKeys.has(first))
          set(this.expandedKeys, new Set(expandedKeys).add(first))
      }
      set(this.#treeSelection, next)
    }
  )

  entryItems: Record<string, DashboardTreeItem> = dispense(id => {
    const entry = this.workspace.dashboard.entries[id]
    return new DashboardTreeItem(
      this,
      id,
      entry.icon,
      entry.label,
      atom(async get => {
        const children = await get(entry.children)
        return children.map(childId => this.entryItems[childId])
      }),
      entry.hasChildren
    )
  })

  rootItems: Record<string, DashboardTreeItem> = dispense(key => {
    const root = this.workspace.root[key]
    return new DashboardTreeItem(
      this,
      `${ROOT_KEY_PREFIX}${root.key}`,
      root.icon,
      root.label,
      atom(async get => {
        const ids = await get(root.children)
        return ids.map(id => this.entryItems[id])
      }),
      root.hasChildren
    )
  })

  items = atom(get => {
    const focusItem = get(this.focusItem)
    if (focusItem) return get(focusItem.items)
    const roots = get(this.workspace.roots)
    return roots.map(key => this.rootItems[key])
  })

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
    public label: Atom<Awaitable<string>>,
    public items: Atom<Awaitable<Array<DashboardTreeItem>>>,
    public hasChildren: Atom<Awaitable<boolean>>
  ) {}

  isExpanded = atom(get => get(this.tree.expandedKeys).has(this.id))
}

export class DashboardEntry {
  constructor(
    public dashboard: Dashboard,
    public id: string
  ) {}

  #treeData = atom(async get => {
    const load = get(this.dashboard.entryLoader)
    const [result, error] = await load(this.id)
    if (error) throw error
    return result
  })

  workspace = atom(async get => {
    const treeData = await get(this.#treeData)
    return this.dashboard.workspace[treeData.workspace]
  })

  root = atom(async get => {
    const workspace = await get(this.workspace)
    const treeData = await get(this.#treeData)
    return workspace.root[treeData.root]
  })

  locales = atom(async get => {
    const treeData = await get(this.#treeData)
    return new Map(
      treeData.entries.map(entry => {
        return [entry.locale, entry] as const
      })
    )
  })

  parentId = atom(async get => {
    const {parentId} = await get(this.#treeData)
    return parentId
  })

  label = atom(async get => {
    const root = await get(this.root)
    const locale = get(root.displayLocale)
    const locales = await get(this.locales)
    const entry = locales.get(locale)
    if (entry?.title) return entry.title
    for (const fallback of locales.values()) {
      if (fallback.title) return fallback.title
    }
    return ''
  })

  orderChildrenBy = atom(async get => {
    const {type} = await get(this.#treeData)
    const config = get(this.dashboard.config)
    const typeConfig = getType(config.schema[type])
    return typeConfig?.orderChildrenBy
  })

  icon = atom(async get => {
    const {type} = await get(this.#treeData)
    const config = get(this.dashboard.config)
    const typeConfig = getType(config.schema[type])
    return typeConfig?.icon
  })

  children = atom(async get => {
    const root = await get(this.root)
    return queryTreeChildren(get, root, this.id, this.orderChildrenBy)
  })

  hasChildren = atom(async get => {
    const root = await get(this.root)
    const db = get(this.dashboard.db)
    const visibleTypes = get(root.workspace.tree.visibleTypes)
    return Boolean(
      await db.first({
        workspace: root.workspace.key,
        root: root.key,
        parentId: this.id,
        filter: {_type: {in: visibleTypes}},
        status: 'preferDraft'
      })
    )
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

  selectedLocale = atom(null)
  displayLocale = atom(get => {
    const route = get(this.workspace.dashboard.route)
    const i18n = get(this.i18n)

    if (route.locale && i18n?.locales.includes(route.locale))
      return route.locale
    return get(this.selectedLocale) ?? i18n?.locales[0] ?? null
  })

  label = atom(get => get(this.#settings).label)
  icon = atom(get => get(this.#settings).icon)
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
  orderByAtom: Atom<Awaitable<Order | Array<Order> | undefined>>
) {
  const visibleTypes = get(root.workspace.tree.visibleTypes)
  const db = get(root.workspace.dashboard.db)
  const orderBy = await get(orderByAtom)
  const locale = get(root.displayLocale)
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
  return [...new Set(orderedChildren.map(child => child.id))]
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
    get(target: Record<string, T>, key: string) {
      if (!(typeof key === 'string')) throw new Error('Key must be a string')
      if (!(key in target)) {
        target[key] = fn(key)
      }
      return target[key]
    }
  })
}
