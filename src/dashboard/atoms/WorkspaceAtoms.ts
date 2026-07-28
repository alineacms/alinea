import {Type} from '#/core/Type.js'
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
import type {Atom, Getter} from 'jotai'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {
  DroppableCollectionInsertDropEvent,
  DroppableCollectionOnItemDropEvent,
  DroppableCollectionReorderEvent,
  Key
} from 'react-aria-components'
import type {TreeSelection} from './Contracts.js'
import type {EntryState} from './EntryAtoms.js'
import {entryAtoms} from './EntryAtoms.js'
import {createRoot, type Root} from './RootAtoms.js'
import type {ComponentType} from 'react'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDragItem,
  dashboardEntryDragType,
  dashboardEntryDragTypes,
  dispense
} from './AtomUtils.js'
import {configAtom, graphAtom} from './CoreAtoms.js'
import {routeAtom} from './NavigationAtoms.js'
import {policyAtom} from './PolicyAtoms.js'
import {
  selectedRootAtom,
  selectedWorkspaceAtom,
  workspaceRootsAtom,
  workspaceSettingsAtom
} from './SelectionAtoms.js'
import type {DashboardEntryTreeStatus} from './EntrySupport.js'

export interface Workspace {
  key: string
  tree: Tree
  color: Atom<string>
  label: Atom<string>
  icon: Atom<ComponentType | undefined>
  roots: Atom<Array<string>>
  root(key: string): Root
  rootMenu: Atom<
    Array<{id: string; label: string; icon: ComponentType | undefined}>
  >
}

export function createWorkspace(key: string): Workspace {
  const treeSelection = atom(
    get => {
      const route = get(routeAtom)
      if (route.workspace && route.workspace !== key) return new Set<Key>()
      if (route.entry) return new Set<Key>([route.entry])
      return new Set<Key>()
    },
    async (get, set, next: 'all' | Set<Key>) => {
      if (next === 'all')
        throw new Error('Selecting all items is not supported')
      const current = get(routeAtom)
      const root = get(selectedRootAtom)
      const selectedKey = next.values().next().value
      if (!selectedKey) {
        await set(routeAtom, {workspace: key})
        return
      }
      const selectedId = String(selectedKey)
      await set(routeAtom, {
        workspace: key,
        root: root ?? undefined,
        entry: selectedId,
        locale: current.locale
      })
    }
  )
  const settings = workspaceSettingsAtom(key)
  const roots = workspaceRootsAtom(key)
  let workspace: Workspace
  const root = dispense(rootKey => createRoot(workspace, rootKey))
  workspace = {
    key,
    tree: undefined as never,
    color: atom(get => get(settings).color),
    label: atom(get => get(settings).label),
    icon: atom(get => get(settings).icon),
    roots,
    root,
    rootMenu: atom(get => {
      return get(roots).map(rootKey => ({
        id: rootKey,
        label: get(root(rootKey).label),
        icon: get(root(rootKey).icon)
      }))
    })
  }
  workspace.tree = createTree(workspace, treeSelection)
  return workspace
}

export const workspaceAtoms = dispense((key: string) => {
  assert(key, 'Workspace key cannot be empty')
  return createWorkspace(key)
})

export const currentWorkspaceAtom = atom(get => {
  const workspace = get(selectedWorkspaceAtom)
  return workspace ? workspaceAtoms(workspace) : null
})

export const selectedMediaRootAtom = atom(get => {
  const workspace = get(currentWorkspaceAtom)
  if (!workspace) return null
  const roots = get(workspace.roots)
  return roots.find(root => get(workspace.root(root).isMedia)) ?? null
})

export const currentRootAtom = atom(get => {
  const workspace = get(currentWorkspaceAtom)
  const root = get(selectedRootAtom)
  if (!workspace || !root) return null
  return workspace.root(root)
})

class TreeModel {
  #treeSelection: TreeSelection
  #syncRouteExpansion: boolean
  constructor(
    private workspace: Workspace,
    treeSelection: TreeSelection,
    options: {syncRouteExpansion?: boolean} = {}
  ) {
    this.#treeSelection = treeSelection
    this.#syncRouteExpansion = options.syncRouteExpansion ?? true
  }

  #routeExpandedKeys = atom(async get => {
    if (!this.#syncRouteExpansion) return new Set<Key>()
    const route = get(routeAtom)
    if (!route.entry || route.workspace !== this.workspace.key)
      return new Set<Key>()
    const entry = entryAtoms(route.entry)
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
        get(routeAtom).entry === String(first)
      ) {
        const expandedKeys = get(this.#expandedKeys)
        if (!expandedKeys.has(first))
          set(this.#expandedKeys, new Set(expandedKeys).add(first))
      }
    }
  )

  entryItems = dispense((id: string): EntryState => {
    return entryAtoms(id)
  })

  items = atom(async get => {
    if (get(selectedWorkspaceAtom) !== this.workspace.key) return []
    const root = get(selectedRootAtom)
    if (!root) return []
    const currentRoot = this.workspace.root(root)
    const ids = await get(currentRoot.children)
    return ids.map(id => this.entryItems(id))
  })

  isExpanded = dispense((entry: EntryState) => {
    return atom(get => get(this.expandedKeys).has(entry.id))
  })

  visibleChildren = dispense((entry: EntryState) => {
    return atom(get => {
      const {data} = get(entry.data)
      if (!data) return undefined
      if (!get(data.hasChildren)) return undefined
      const children = get(unwrap(data.children))
      return children?.map(childId => this.entryItems(childId))
    })
  })

  selectedAncestorStatus = dispense((entry: EntryState) => {
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

  children = dispense((entry: EntryState) => {
    return atom(get => {
      if (!get(this.isExpanded(entry))) return undefined
      return get(this.visibleChildren(entry))
    })
  })

  // dnd
  acceptedDragTypes = [...dashboardEntryDragTypes]

  getItems = atom(null, (get, set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(id => dashboardEntryDragItem(id))
  })

  dragDisabled = atom(get => {
    if (get(selectedWorkspaceAtom) !== this.workspace.key) return true
    const root = get(selectedRootAtom)
    if (!root) return true
    const policy = get(policyAtom)
    const resource = {workspace: this.workspace.key, root}
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
    const db = get(graphAtom)
    const policy = get(policyAtom)
    const selectedRoot = get(selectedRootAtom)
    if (!selectedRoot) return
    const {moveTarget, targetType} = this.#target(target.key, selectedRoot)
    for (const key of keys) {
      const draggedId = String(key)
      const entry = entryAtoms(draggedId)
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
      if (item.types.has(dashboardEntryDragType)) {
        draggedId = await item.getText(dashboardEntryDragType)
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
    const config = get(configAtom)
    return Object.entries(config.schema)
      .filter(([, type]) => !Type.isHidden(type))
      .map(([name]) => name)
  })
}

export type Tree = Pick<TreeModel, keyof TreeModel>

export function createTree(
  workspace: Workspace,
  treeSelection: TreeSelection,
  options: {syncRouteExpansion?: boolean} = {}
) {
  return new TreeModel(workspace, treeSelection, options)
}
