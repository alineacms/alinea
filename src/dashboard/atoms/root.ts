import type {EntryStatus} from '#/core/Entry.js'
import {Permission, type Resource} from '#/core/Role.js'
import {Root, type RootData, type RootI18n} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import type {Order} from '#/core/Graph.js'
import {getExpr, getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {
  ExplorerAtoms,
  type ExplorerLocation
} from '#/dashboard/atoms/explorer.js'
import {type Atom, atom, type Getter, type PrimitiveAtom} from 'jotai'
import {selectAtom, unwrap} from 'jotai/utils'
import type {ComponentType, SetStateAction} from 'react'
import type {
  DragMoveEvent,
  DropItemsEvent,
  DropTarget,
  Key
} from '#/components.js'
import type {RootViewProps} from '../cms/ViewProps.js'
import {IcOutlineDescription} from '../icons.js'
import {viewAtoms} from './config.js'
import {configAtom, graphAtom} from './core.js'
import {
  loadTreeChildren,
  MissingEntryError,
  treeEntryAtoms,
  type TreeEntryAtoms,
  type TreeEntrySummary
} from './entry.js'
import {shaAtom} from './graph.js'
import {overviewSortAtom, type Page, pageAtom, routeAtom} from './nav.js'
import type {OverviewFilterSelection} from './overview.js'
import {policyAtom} from './user.js'
import {
  dashboardEntryDragItem,
  dashboardEntryDragTypes,
  dashboardEntryDropIds,
  dispense,
  moveEntries
} from './utils.js'

export interface RootTreeItem {
  id: string
  title: string
  type: string
  status: EntryStatus
  main: boolean
  locale: string | null
  parentId: string | null
  parents: Array<string>
  hasChildren: boolean
  /** Its parent orders its children, so it keeps its place among them */
  ordered?: boolean
}

export interface RootTreeNode {
  id: string
  children: Array<RootTreeNode>
}

export interface TreeSnapshot {
  expandedKeys: Set<string>
  items: Array<RootTreeNode>
  selectedKeys: Set<string>
  /** The closest listed ancestor of a selected entry the tree does not list */
  locationKey?: string
}

export interface TreeView {
  entries: Map<string, RootTreeItem>
  snapshot: TreeSnapshot
}

interface TreeCollapseState {
  selectedId: string | undefined
  keys: Set<string>
}

interface TreeViewState {
  expandedKeys: PrimitiveAtom<Set<string>>
  collapsedKeys: PrimitiveAtom<TreeCollapseState>
}

const emptyTreeSnapshot: TreeSnapshot = {
  expandedKeys: new Set(),
  items: [],
  selectedKeys: new Set()
}

const emptyTreeView: TreeView = {
  entries: new Map(),
  snapshot: emptyTreeSnapshot
}

export class TreeAtoms {
  expandedKeys: PrimitiveAtom<Set<string>>
  collapsedKeys: PrimitiveAtom<TreeCollapseState>
  #root: RootAtoms
  #locale: string | null
  #selectedKeys: Atom<Set<Key>>
  #permission: Permission

  constructor(
    root: RootAtoms,
    locale: string | null,
    selectedKeys: Atom<Set<Key>>,
    viewState?: TreeViewState,
    permission = Permission.Read
  ) {
    this.#root = root
    this.#locale = locale
    this.#selectedKeys = selectedKeys
    this.#permission = permission
    this.expandedKeys = viewState?.expandedKeys ?? atom(new Set<string>())
    this.collapsedKeys =
      viewState?.collapsedKeys ??
      atom<TreeCollapseState>({
        selectedId: undefined,
        keys: new Set<string>()
      })
  }

  #source = atom(async (get): Promise<TreeView> => {
    const config = get(configAtom)
    const locale = this.#locale
    const permission = this.#permission
    async function listed(model: TreeEntryAtoms) {
      try {
        return await get(model.summary(locale))
      } catch (error) {
        if (error instanceof MissingEntryError) return undefined
        throw error
      }
    }
    async function ancestors(model: TreeEntryAtoms) {
      try {
        return await get(model.parents)
      } catch (error) {
        if (error instanceof MissingEntryError) return []
        throw error
      }
    }
    let selectedKeys = new Set([...get(this.#selectedKeys)].map(String))
    let locationKey: string | undefined
    const requestedId = [...selectedKeys][0]
    let selectedModel = requestedId
      ? treeEntryAtoms(requestedId, permission)
      : undefined
    let selected = selectedModel ? await listed(selectedModel) : undefined
    // The tree does not list some entries, such as media files, so it
    // reveals their closest listed ancestor as their location instead
    if (selectedModel && !selected) {
      for (const ancestor of (await ancestors(selectedModel)).toReversed()) {
        selected = await listed(ancestor)
        if (!selected) continue
        selectedModel = ancestor
        selectedKeys = new Set()
        locationKey = ancestor.id
        break
      }
    }
    const selectedId = locationKey ?? [...selectedKeys][0]
    const parents =
      selectedModel && selected ? await get(selectedModel.parents) : []
    const models = new Map(parents.map(parent => [parent.id, parent]))
    if (selectedModel && selected) models.set(selectedModel.id, selectedModel)
    const collapsed = get(this.collapsedKeys)
    const collapsedKeys =
      collapsed.selectedId === selectedId ? collapsed.keys : new Set<string>()
    const expandedKeys = new Set(get(this.expandedKeys))
    for (const parentId of selected?.parents ?? [])
      if (!collapsedKeys.has(parentId)) expandedKeys.add(parentId)

    const missingModels = (
      await Promise.all(
        [...expandedKeys]
          .filter(id => !models.has(id))
          .map(async id => {
            try {
              return await get(treeEntryAtoms(id, permission).ready)
            } catch (error) {
              if (error instanceof MissingEntryError) return undefined
              throw error
            }
          })
      )
    ).filter((model): model is TreeEntryAtoms => Boolean(model))
    for (const model of missingModels) models.set(model.id, model)

    const expandedModels = [...expandedKeys].flatMap(id => {
      const model = models.get(id)
      return model ? [model] : []
    })
    const [rootModels, childLevels, parentEntries] = await Promise.all([
      get(this.#root.treeEntries(this.#locale, permission)),
      Promise.all(
        expandedModels.map(model => get(model.children(this.#locale)))
      ),
      Promise.all(expandedModels.map(model => get(model.raw(this.#locale))))
    ])
    const levels = [rootModels, ...childLevels]
    const levelOrders = [
      Root.childrenOrder(get(this.#root.data)),
      ...parentEntries.map(entry => {
        const type = config.schema[entry.type]
        return type && Type.childrenOrder(type)
      })
    ]
    const levelItems = await Promise.all(
      levels.map((level, index) =>
        Promise.all(
          level.map(async model =>
            rootTreeItem(
              await get(model.summary(this.#locale)),
              levelOrders[index]
            )
          )
        )
      )
    )

    const entries = new Map<string, RootTreeItem>()
    const children = new Map<string | null, Array<string>>()
    const parentIds: Array<string | null> = [
      null,
      ...expandedModels.map(model => model.id)
    ]
    for (const [index, level] of levelItems.entries()) {
      const parentId = parentIds[index] ?? null
      children.set(
        parentId,
        level.map(entry => entry.id)
      )
      for (const entry of level) entries.set(entry.id, entry)
    }
    function nested(parentId: string | null): Array<RootTreeNode> {
      return (children.get(parentId) ?? []).map(id => ({
        id,
        children: expandedKeys.has(id) ? nested(id) : []
      }))
    }
    return {
      entries,
      snapshot: {expandedKeys, items: nested(null), selectedKeys, locationKey}
    }
  })

  #state = unwrap(this.#source, previous => previous)
  view = atom(get => get(this.#state) ?? emptyTreeView)
  snapshot = atom(get => get(this.view).snapshot)
  items = atom(get => [...get(this.view).entries.values()])
  #itemSource = dispense((id: string) =>
    atom(async get => {
      const model = treeEntryAtoms(id, this.#permission)
      const entry = await get(model.summary(this.#locale))
      const config = get(configAtom)
      const parent = entry.parentId
        ? await get(
            treeEntryAtoms(entry.parentId, this.#permission).raw(this.#locale)
          )
        : undefined
      const parentType = parent ? config.schema[parent.type] : undefined
      const order = parent
        ? parentType && Type.childrenOrder(parentType)
        : Root.childrenOrder(get(this.#root.data))
      return rootTreeItem(entry, order)
    })
  )
  children = dispense((id: string) =>
    treeEntryAtoms(id, this.#permission).children(this.#locale)
  )
  #itemState = dispense((id: string) =>
    unwrap(this.#itemSource(id), previous => previous)
  )
  item = dispense((id: string) =>
    atom(get => {
      const loaded = get(this.#state)?.entries.get(id)
      try {
        const item = get(this.#itemState(id))
        if (item) return item
      } catch (error) {
        const isLoading = error instanceof Promise
        if (!loaded || (!isLoading && !(error instanceof MissingEntryError)))
          throw error
      }
      if (loaded) return loaded
      throw get(this.#itemSource(id))
    })
  )
  /** The selected entry, or the location of a selected entry that is not listed */
  selectedItem = atom(get => {
    const state = get(this.#state)
    return state && locatedItem(state)
  })
  canCreate = atom(get => {
    if (get(this.#root.canCreate)) return true
    const state = get(this.#state)
    const selected = get(this.selectedItem)
    if (!state || !selected) return false
    const config = get(configAtom)
    const selectedType = config.schema[selected.type]
    // New entries are created inside the selected container, or next to the
    // selected entry
    const parent =
      selectedType && Type.isContainer(selectedType)
        ? selected
        : selected.parentId
          ? state.entries.get(selected.parentId)
          : undefined
    const parentType = parent && config.schema[parent.type]
    if (!parent || !parentType) return false
    return containsCreatableType(
      get,
      {
        workspace: this.#root.workspace,
        root: this.#root.key,
        locale: this.#locale,
        parents: [parent.id, ...parent.parents]
      },
      Type.contains(parentType)
    )
  })
  ready = atom(async get => {
    get(this.snapshot)
    const source = await get(this.#source)
    await Promise.all(
      [...source.entries.keys()].map(id => get(this.#itemSource(id)))
    )
    return source
  })
}

export class RootAtoms {
  readonly data: Atom<RootData>
  readonly tree: (locale: string | null) => TreeAtoms
  explorer: ExplorerAtoms

  /**
   * The last page shown within this root. Explorers keep reading it after
   * navigating away, so the page that is still rendered while the next one
   * loads does not reload in another locale.
   */
  #lastPage = selectAtom<Page, Page | undefined>(pageAtom, (page, previous) =>
    page.workspace === this.workspace && page.root === this.key
      ? page
      : previous
  )
  /** Explorers list the locale of the page, which the route selects */
  #explorerLocale = atom(
    get =>
      get(this.data).isMediaRoot ? null : (get(this.#lastPage)?.locale ?? null),
    (_get, _set, _update: SetStateAction<string | null>) => {}
  )

  constructor(
    public readonly workspace: string,
    public readonly key: string
  ) {
    this.data = atom(get => {
      const config = get(configAtom)
      const workspaceConfig = config.workspaces[this.workspace]
      if (!workspaceConfig)
        throw new Error(`Workspace "${this.workspace}" not found in config`)
      const rootConfig = getWorkspace(workspaceConfig).roots[this.key]
      if (!rootConfig)
        throw new Error(
          `Root "${this.key}" not found in workspace "${this.workspace}"`
        )
      return getRoot(rootConfig)
    })
    const selectedKeys = atom(get => {
      const page = get(pageAtom)
      return page.workspace === this.workspace &&
        page.root === this.key &&
        page.entry
        ? new Set<Key>([page.entry])
        : new Set<Key>()
    })
    const treeViewState: TreeViewState = {
      expandedKeys: atom(new Set<string>()),
      collapsedKeys: atom<TreeCollapseState>({
        selectedId: undefined,
        keys: new Set<string>()
      })
    }
    this.tree = dispense(
      (locale: string | null) =>
        new TreeAtoms(this, locale, selectedKeys, treeViewState)
    )
    this.explorer = this.children(null)
  }

  /** A tree that lists the entries the policy allows with the permission */
  createTree(
    locale: string | null,
    selectedKeys: Atom<Set<Key>>,
    expandedKeys?: PrimitiveAtom<Set<string>>,
    permission = Permission.Read
  ) {
    return new TreeAtoms(
      this,
      locale,
      selectedKeys,
      expandedKeys
        ? {
            expandedKeys,
            collapsedKeys: atom<TreeCollapseState>({
              selectedId: undefined,
              keys: new Set<string>()
            })
          }
        : undefined,
      permission
    )
  }

  #treeEntries = dispense((locale: string | null, permission: Permission) =>
    atom(async get => {
      get(shaAtom)
      const data = get(this.data)
      return loadTreeChildren(
        get,
        {workspace: this.workspace, root: this.key, parentId: null},
        locale,
        permission,
        Root.childrenOrder(data)
      )
    })
  )

  treeEntries(locale: string | null, permission = Permission.Read) {
    return this.#treeEntries(locale, permission)
  }

  /**
   * The scroll offsets of the explorers of this root. The root explorer and
   * the overview of an entry can list the same location, which then keeps its
   * scroll offset when the editor returns to it through either of them.
   */
  explorerScrollOffset = dispense((_key: string) => atom(0))

  /**
   * The filters picked in the explorers of this root, kept while the editor
   * opens entries and folders. Each overview applies the ones it declares.
   */
  #explorerFilters = atom<OverviewFilterSelection>({})

  children = dispense((parentId: string | null) => {
    const location: ExplorerLocation = {
      workspace: this.workspace,
      root: this.key,
      parentId: parentId ?? undefined
    }
    return new ExplorerAtoms(
      // The explorer of a page lists the location of its route, browsing to
      // another location navigates to its page
      atom(
        () => location,
        (get, set, update: SetStateAction<ExplorerLocation>) => {
          const next = typeof update === 'function' ? update(location) : update
          set(routeAtom, {
            workspace: next.workspace,
            root: next.root,
            entry: next.parentId,
            locale: next.locale ?? get(this.#explorerLocale) ?? undefined,
            view: next.parentId ? 'overview' : undefined
          })
        }
      ),
      {
        enableNavigation: true,
        sortState: overviewSortAtom(this.workspace, this.key, parentId),
        rootData: this.data,
        filterState: this.#explorerFilters,
        scrollOffset: this.explorerScrollOffset,
        selectedLocaleAtom: this.#explorerLocale,
        selectionBehavior: 'toggle',
        selectionMode: 'multiple'
      },
      location
    )
  })

  label = atom(get => get(this.data).label)
  icon = atom(get => get(this.data).icon ?? IcOutlineDescription)
  i18n = atom((get): RootI18n | undefined => {
    const data = get(this.data)
    return data.isMediaRoot ? undefined : data.i18n
  })
  isMedia = atom(get => Boolean(get(this.data).isMediaRoot))
  canCreate = atom(get =>
    containsCreatableType(
      get,
      {workspace: this.workspace, root: this.key},
      get(this.data).contains ?? []
    )
  )
  view = atom((get): ComponentType<RootViewProps> | undefined => {
    const view = get(this.data).view
    if (!view) return undefined
    return typeof view === 'string'
      ? (get(viewAtoms(view)) as ComponentType<RootViewProps> | undefined)
      : view
  })
  acceptedDragTypes = [...dashboardEntryDragTypes]
  getItems = atom(
    null,
    (_get, _set, keys: ReadonlySet<Key>): Array<Record<string, string>> => {
      return [...keys].map(dashboardEntryDragItem)
    }
  )
  dragDisabled = atom(get => {
    const policy = get(policyAtom)
    const resource = {workspace: this.workspace, root: this.key}
    return !policy.canMove(resource) && !policy.canReorder(resource)
  })
  onMove = atom(
    null,
    async (get, _set, event: DragMoveEvent, tree: TreeAtoms) => {
      const policy = get(policyAtom)
      const permission =
        event.target.position === 'on' ? Permission.Move : Permission.Reorder
      const {schema} = get(configAtom)
      const {entries} = get(tree.view)
      if (!treeAcceptsDrop(schema, entries, event.target, event.keys)) return
      // Move entries in the order they are listed rather than selected
      const moving = get(tree.items).filter(item => event.keys.has(item.id))
      for (const item of moving)
        policy.assert(permission, {
          workspace: this.workspace,
          root: this.key,
          id: item.id,
          type: item.type,
          locale: item.locale,
          parents: item.parents
        })
      await moveEntries(
        get(graphAtom),
        moving.map(item => item.id),
        event.target
      )
    }
  )
  onDrop = atom(null, async (get, _set, event: DropItemsEvent) => {
    await moveEntries(
      get(graphAtom),
      dashboardEntryDropIds(event.items),
      event.target
    )
  })
}

export const rootAtoms = dispense(
  (workspace: string, root: string) => new RootAtoms(workspace, root)
)

/**
 * Entries can be dropped on a container, but only placed before or after the
 * children of a parent that does not order them, and never inside themselves
 */
export function treeAcceptsDrop(
  schema: Schema,
  entries: Map<string, RootTreeItem>,
  target: DropTarget,
  keys: ReadonlySet<Key> = new Set()
): boolean {
  const entry = entries.get(String(target.key))
  if (!entry || entry.parents.some(id => keys.has(id))) return false
  if (target.position !== 'on') return !entry.ordered
  const type = schema[entry.type]
  return !keys.has(entry.id) && Boolean(type && Type.isContainer(type))
}

/** The selected entry, or the location of a selected entry that is not listed */
export function locatedItem({
  entries,
  snapshot
}: TreeView): RootTreeItem | undefined {
  const id = snapshot.locationKey ?? [...snapshot.selectedKeys][0]
  return id ? entries.get(id) : undefined
}

/**
 * Whether the order of the parent places entries of a type other than in
 * their manual order. Media folders keep theirs, before the files.
 */
function ordersType(order: Order | Array<Order> | undefined, type: string) {
  const [first] = order ? [order].flat() : []
  if (!first) return false
  let expr = getExpr(first.asc ?? first.desc)
  if (expr.type === 'typeSwitch') {
    const inner = expr.cases[type]
    if (!inner) return true
    expr = getExpr(inner)
  }
  return !first.asc || expr.type !== 'entryField' || expr.name !== 'index'
}

function rootTreeItem(
  entry: TreeEntrySummary,
  order: Order | Array<Order> | undefined
): RootTreeItem {
  return {
    id: entry.id,
    title: entry.title,
    type: entry.type,
    status: entry.status,
    main: entry.main,
    locale: entry.locale,
    parentId: entry.parentId,
    parents: entry.parents,
    hasChildren: entry.hasChildren,
    ordered: ordersType(order, entry.type)
  }
}

/**
 * Whether any type accepted by `contains`, or nested in one of its containers,
 * can be created at the given resource
 */
function containsCreatableType(
  get: Getter,
  resource: Resource,
  contains: Array<string | Type>
): boolean {
  const policy = get(policyAtom)
  const config = get(configAtom)
  const seen = new Set<string>()
  const queue = Schema.contained(config.schema, contains)
  while (queue.length > 0) {
    const typeName = queue.shift()!
    if (seen.has(typeName)) continue
    seen.add(typeName)
    const type = config.schema[typeName]
    if (!type || Type.isHidden(type)) continue
    if (policy.canCreate({...resource, type: typeName})) return true
    if (Type.isContainer(type))
      queue.push(...Schema.contained(config.schema, Type.contains(type)))
  }
  return false
}
