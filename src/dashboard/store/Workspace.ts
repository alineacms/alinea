import {Type} from '#/core/Type.js'
import {getWorkspace} from '#/core/Internal.js'
import {Permission} from '#/core/Role.js'
import {assert} from '#/core/util/Assert.js'
import type {
  DragItem,
  DragTypes,
  DropItem,
  DropOperation,
  DropTarget,
  ItemDropTarget
} from '@react-types/shared'
import type {Getter} from 'jotai'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {
  DroppableCollectionInsertDropEvent,
  DroppableCollectionOnItemDropEvent,
  DroppableCollectionReorderEvent,
  Key
} from 'react-aria-components'
import type {
  Dashboard,
  DashboardEntry,
  DashboardEntryTreeStatus,
  DashboardTreeSelection
} from './Dashboard.js'
import {createRoot} from './Root.js'
import {dispense} from './StoreUtils.js'

const DASHBOARD_ENTRY_DRAG_TYPE = 'application/x-alinea-entry-id'

function acceptsDashboardEntryDrag(types: DragTypes) {
  return types.has(DASHBOARD_ENTRY_DRAG_TYPE) || types.has('text/plain')
}

function dragItem(id: Key): DragItem {
  const key = String(id)
  return {
    'text/plain': key,
    [DASHBOARD_ENTRY_DRAG_TYPE]: key
  }
}

export class Workspace {
  constructor(
    public dashboard: Dashboard,
    public key: string
  ) {}

  #treeSelection = atom(
    get => {
      const route = get(this.dashboard.route)
      if (route.workspace && route.workspace !== this.key) return new Set<Key>()
      if (route.entry) return new Set<Key>([route.entry])
      return new Set<Key>()
    },
    async (get, set, next: 'all' | Set<Key>) => {
      if (next === 'all')
        throw new Error('Selecting all items is not supported')
      const current = get(this.dashboard.route)
      const root = get(this.dashboard.selectedRoot)
      const selectedKey = next.values().next().value
      if (!selectedKey) {
        await set(this.dashboard.route, {workspace: this.key})
        return
      }
      const selectedId = String(selectedKey)
      await set(this.dashboard.route, {
        workspace: this.key,
        root: root ?? undefined,
        entry: selectedId,
        locale: current.locale
      })
    }
  )

  tree = createTree(this, this.#treeSelection)

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
    const policy = get(this.dashboard.policy)
    return Object.keys(roots).filter(root => {
      return policy.canRead({workspace: this.key, root})
    })
  })

  root = dispense(key => createRoot(this, key))

  rootMenu = atom(get => {
    const roots = get(this.roots)
    return roots.map(root => ({
      id: root,
      label: get(this.root(root).label),
      icon: get(this.root(root).icon)
    }))
  })
}

export class Tree {
  #treeSelection: DashboardTreeSelection
  #syncRouteExpansion: boolean
  constructor(
    private workspace: Workspace,
    treeSelection: DashboardTreeSelection,
    options: {syncRouteExpansion?: boolean} = {}
  ) {
    this.#treeSelection = treeSelection
    this.#syncRouteExpansion = options.syncRouteExpansion ?? true
  }

  #routeExpandedKeys = atom(async get => {
    if (!this.#syncRouteExpansion) return new Set<Key>()
    const route = get(this.workspace.dashboard.route)
    if (!route.entry || route.workspace !== this.workspace.key)
      return new Set<Key>()
    const entry = this.workspace.dashboard.entries(route.entry)
    const {data} = get(entry.data)
    if (!data) return new Set<Key>()
    return new Set<Key>(get(data.parentIds))
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
    async (get, set, next: 'all' | Set<Key>) => {
      assert(next !== 'all', 'Selecting all items is not supported')
      const [first] = next
      await set(this.#treeSelection, next)
      if (
        first &&
        get(this.workspace.dashboard.route).entry === String(first)
      ) {
        const expandedKeys = get(this.#expandedKeys)
        if (!expandedKeys.has(first))
          set(this.#expandedKeys, new Set(expandedKeys).add(first))
      }
    }
  )

  entryItems = dispense((id: string): DashboardEntry => {
    return this.workspace.dashboard.entries(id)
  })

  items = atom(async get => {
    const currentRoot = get(this.workspace.dashboard.currentRoot)
    if (!currentRoot || currentRoot.workspace.key !== this.workspace.key)
      return []
    const ids = await get(currentRoot.children)
    return ids.map(id => this.entryItems(id))
  })

  isExpanded = dispense((entry: DashboardEntry) => {
    return atom(get => get(this.expandedKeys).has(entry.id))
  })

  visibleChildren = dispense((entry: DashboardEntry) => {
    return atom(get => {
      const {data} = get(entry.data)
      if (!data) return undefined
      if (!get(data.hasChildren)) return undefined
      const children = get(unwrap(data.children))
      return children?.map(childId => this.entryItems(childId))
    })
  })

  selectedAncestorStatus = dispense((entry: DashboardEntry) => {
    return atom(async (get): Promise<DashboardEntryTreeStatus | undefined> => {
      const {data} = get(entry.data)
      if (!data) return undefined
      const selectedKey = get(this.selectedKeys).values().next().value
      if (!selectedKey) return undefined
      const selectedId = String(selectedKey)
      if (selectedId === entry.id) return undefined
      if (!get(data.parentIds).includes(selectedId)) return undefined
      const selected = this.entryItems(selectedId)
      const {data: selectedData} = get(selected.data)
      if (!selectedData) return undefined
      return get(selectedData.treeStatus)
    })
  })

  children = dispense((entry: DashboardEntry) => {
    return atom(get => {
      if (!get(this.isExpanded(entry))) return undefined
      return get(this.visibleChildren(entry))
    })
  })

  // dnd
  acceptedDragTypes = [DASHBOARD_ENTRY_DRAG_TYPE, 'text/plain']

  getItems = atom(null, (get, set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(id => dragItem(id))
  })

  dragDisabled = atom(get => {
    const currentRoot = get(this.workspace.dashboard.currentRoot)
    if (!currentRoot) return true
    const policy = get(this.workspace.dashboard.policy)
    const resource = {workspace: this.workspace.key, root: currentRoot.key}
    return !policy.canMove(resource) && !policy.canReorder(resource)
  })

  getDropOperation = atom(
    null,
    (
      get,
      set,
      _target: DropTarget,
      types: DragTypes,
      allowedOperations: Array<DropOperation>
    ) => {
      if (!acceptsDashboardEntryDrag(types)) return 'cancel'
      return allowedOperations.includes('move') ? 'move' : 'cancel'
    }
  )

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
    const policy = get(this.workspace.dashboard.policy)
    const selectedRoot = get(this.workspace.dashboard.selectedRoot)
    if (!selectedRoot) return
    const {moveTarget, targetType} = this.#target(target.key, selectedRoot)
    for (const key of keys) {
      const draggedId = String(key)
      const entry = this.workspace.dashboard.entries(draggedId)
      const {data} = get(entry.data)
      assert(data, `Entry "${draggedId}" is not loaded`)
      const [resource] = get(data.entryData).entries
      const permission =
        target.dropPosition === 'on' ? Permission.Move : Permission.Reorder
      policy.assert(permission, resource)
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
      if (!draggedId) continue
      draggedKeys.add(draggedId)
    }
    await this.#moveDraggedKeys(get, draggedKeys, target)
  }

  #target(key: Key | undefined, selectedRoot: string) {
    if (!key) {
      return {
        moveTarget: selectedRoot,
        targetType: 'root'
      } as const
    }
    const targetId = String(key)
    return {
      moveTarget: targetId,
      targetType: 'entry'
    } as const
  }

  visibleTypes = atom(get => {
    const config = get(this.workspace.dashboard.config)
    return Object.entries(config.schema)
      .filter(([, type]) => !Type.isHidden(type))
      .map(([name]) => name)
  })
}

export function createWorkspace(dashboard: Dashboard, key: string) {
  return new Workspace(dashboard, key)
}

export function createTree(
  workspace: Workspace,
  treeSelection: DashboardTreeSelection,
  options: {syncRouteExpansion?: boolean} = {}
) {
  return new Tree(workspace, treeSelection, options)
}

/** @deprecated Use Workspace or createWorkspace. */
export {Workspace as DashboardWorkspace}
/** @deprecated Use Tree or createTree. */
export {Tree as DashboardTree}
