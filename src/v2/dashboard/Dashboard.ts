import type {Config} from 'alinea/core/Config'
import type {LocalConnection} from 'alinea/core/Connection'
import type {LocalDB} from 'alinea/core/db/LocalDB'
import {Entry} from 'alinea/core/Entry'
import type {Order} from 'alinea/core/Graph'
import {getRoot, getType, getWorkspace} from 'alinea/core/Internal'
import {Type} from 'alinea/core/Type'
import {assert} from 'alinea/core/util/Assert'
import {parents, translations} from 'alinea/query'
import {type Atom, atom} from 'jotai'
import {atomWithLocation} from 'jotai-location'
import {ComponentType} from 'react'
import {Key} from 'react-aria-components'

export interface DashboardRoute {
  workspace?: string
  root?: string
  entry?: string
  locale?: string
}

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
}

export class DashboardWorkspace {
  constructor(
    public dashboard: Dashboard,
    public key: string
  ) {}

  tree = new DashboardTree(this)

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
  constructor(private workspace: DashboardWorkspace) {}

  focusItem = atom<DashboardTreeItem>()
  expandedKeys = atom(new Set<Key>())

  #selection = atom(new Set<Key>())
  selectedKeys = atom(
    get => {
      const selection = get(this.#selection)
      if (selection.size > 0) return selection
      const route = get(this.workspace.dashboard.route)
      if (route.entry) return new Set([route.entry])
      if (route.root) return new Set([`root:${route.root}`])
      return selection
    },
    (get, set, next: 'all' | Set<Key>) => {
      if (next === 'all')
        throw new Error('Selecting all items is not supported')
      set(this.#selection, next)
      // todo:
      //set(this.workspace.dashboard.route, entry/route)
    }
  )

  items = atom(get => {
    const focusItem = get(this.focusItem)
    if (focusItem) return get(focusItem.items)
    const roots = get(this.workspace.roots)
    return roots.map(key => this.workspace.root[key].treeItem)
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
    public root: DashboardRoot,
    public id: string
  ) {
    this.#children = treeChildren(this.root, this.id, this.orderChildrenBy)
    this.treeItem = new DashboardTreeItem(
      this.root.workspace.tree,
      id,
      this.icon,
      atom(async get => {
        const locale = get(this.root.displayLocale)
        const locales = await get(this.locales)
        const entry = locales.get(locale)
        if (entry?.title) return entry.title
        // Fallback to any available locale if the preferred one doesn't have a title
        for (const entry of locales.values()) {
          if (entry.title) return entry.title
        }
        return ''
      }),
      atom(async get => {
        const children = await get(this.#children)
        return children.map(id => this.root.entries[id].treeItem)
      }),
      this.hasChildren
    )
  }

  #treeData = atom(async get => {
    const load = get(this.root.entryLoader)
    const [result, error] = await load(this.id)
    if (error) throw error
    console.log('loaded', {id: this.id, result})
    return result
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

  orderChildrenBy = atom(async get => {
    const {type} = await get(this.#treeData)
    const config = get(this.root.workspace.dashboard.config)
    const typeConfig = getType(config.schema[type])
    return typeConfig?.orderChildrenBy
  })

  icon = atom(async get => {
    const {type} = await get(this.#treeData)
    const config = get(this.root.workspace.dashboard.config)
    const typeConfig = getType(config.schema[type])
    return typeConfig?.icon
  })

  #children: Atom<Awaitable<Array<string>>>
  treeItem: DashboardTreeItem

  hasChildren = atom(async get => {
    const db = get(this.root.workspace.dashboard.db)
    const visibleTypes = get(this.root.workspace.tree.visibleTypes)
    return Boolean(
      await db.first({
        workspace: this.root.workspace.key,
        root: this.root.key,
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
  ) {
    this.treeItem = new DashboardTreeItem(
      this.workspace.tree,
      `root:${this.key}`,
      this.icon,
      this.label,
      atom(async get => {
        const ids = await get(this.#children)
        return ids.map(id => this.entries[id].treeItem)
      }),
      this.hasChildren
    )
  }

  #settings = atom(get => {
    const config = get(this.workspace.dashboard.config)
    const workspaceConfig = config.workspaces[this.workspace.key]
    assert(workspaceConfig)
    const rootConfig = workspaceConfig[this.key]
    return getRoot(rootConfig)
  })

  selectedLocale = atom(null)
  displayLocale = atom(get => {
    const i18n = get(this.i18n)
    return get(this.selectedLocale) ?? i18n?.locales[0] ?? null
  })

  label = atom(get => get(this.#settings).label)
  icon = atom(get => get(this.#settings).icon)
  i18n = atom(get => get(this.#settings).i18n)
  view = atom(get => get(this.#settings).view)
  orderChildrenBy = atom(get => get(this.#settings).orderChildrenBy)

  entries = dispense(id => new DashboardEntry(this, id))

  entryLoader = atom(get => {
    const db = get(this.workspace.dashboard.db)
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
          entries: translations({select: data, includeSelf: true})
        },
        id: {in: ids},
        status: 'preferDraft'
      })
      return rows.map(row => [row, null] as const)
    })
  })

  #children = treeChildren(this, null, this.orderChildrenBy)
  treeItem: DashboardTreeItem

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

function treeChildren(
  root: DashboardRoot,
  parentId: null | string,
  orderByAtom: Atom<Awaitable<Order | Array<Order> | undefined>>
) {
  return atom(async get => {
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
  })
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
                result[index] ?? [item.key, null, new Error('Missing result')]
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
