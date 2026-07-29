import type {Config} from '#/core/Config.js'
import {Permission} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
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
import type {ComponentType} from 'react'
import type {
  DroppableCollectionInsertDropEvent,
  DroppableCollectionOnItemDropEvent,
  DroppableCollectionReorderEvent,
  Key
} from 'react-aria-components'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDragItem,
  dashboardEntryDragType,
  dashboardEntryDragTypes,
  dispense,
  requiredAtom
} from './AtomUtils.js'
import type {TreeSelection} from './Contracts.js'
import {entryAtoms} from './EntryAtoms.js'
import {graphAtom} from './GraphAtoms.js'
import {routeAtom} from './RoutingAtoms.js'
import {policyAtom} from './UserAtoms.js'
import {createRoot, type RootAtoms} from './RootAtoms.js'
import {
  selectedRootAtom,
  selectedWorkspaceAtom,
  workspaceRootsAtom,
  workspaceSettingsAtom
} from './RoutingAtoms.js'

export const configAtom = requiredAtom<Config>('dashboard.config')
export const viewsAtom =
  requiredAtom<Record<string, ComponentType>>('dashboard.views')

export const viewAtom = dispense(key => {
  return atom((get): ComponentType | undefined => {
    return get(viewsAtom)[key]
  })
})

export interface WorkspaceAtoms {
  key: string
  tree: TreeAtoms
  color: Atom<string>
  label: Atom<string>
  icon: Atom<ComponentType | undefined>
  roots: Atom<Array<string>>
  root(key: string): RootAtoms
  rootMenu: Atom<
    Array<{id: string; label: string; icon: ComponentType | undefined}>
  >
}

class WorkspaceAtomsImpl implements WorkspaceAtoms {
  tree: TreeAtoms
  color: Atom<string>
  label: Atom<string>
  icon: Atom<ComponentType | undefined>
  roots: Atom<Array<string>>
  root: (key: string) => RootAtoms
  rootMenu: WorkspaceAtoms['rootMenu']

  constructor(public key: string) {
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
        await set(routeAtom, {
          workspace: key,
          root: root ?? undefined,
          entry: String(selectedKey),
          locale: current.locale
        })
      }
    )
    const settings = workspaceSettingsAtom(key)
    this.roots = workspaceRootsAtom(key)
    this.root = dispense(rootKey => createRoot(this, rootKey))
    this.color = atom(get => get(settings).color)
    this.label = atom(get => get(settings).label)
    this.icon = atom(get => get(settings).icon)
    this.rootMenu = atom(get => {
      return get(this.roots).map(rootKey => ({
        id: rootKey,
        label: get(this.root(rootKey).label),
        icon: get(this.root(rootKey).icon)
      }))
    })
    this.tree = createTree(this, treeSelection)
  }
}

export function createWorkspace(key: string): WorkspaceAtoms {
  return new WorkspaceAtomsImpl(key)
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

class TreeAtomsImpl {
  #treeSelection: TreeSelection
  #syncRouteExpansion: boolean
  constructor(
    private workspace: WorkspaceAtoms,
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
      if (first && get(routeAtom).entry === String(first)) {
        const expandedKeys = get(this.#expandedKeys)
        if (!expandedKeys.has(first))
          set(this.#expandedKeys, new Set(expandedKeys).add(first))
      }
    }
  )

  items = atom(async get => {
    if (get(selectedWorkspaceAtom) !== this.workspace.key) return []
    const root = get(selectedRootAtom)
    if (!root) return []
    const currentRoot = this.workspace.root(root)
    const ids = await get(currentRoot.children)
    return ids.map(entryAtoms)
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

export type TreeAtoms = Pick<TreeAtomsImpl, keyof TreeAtomsImpl>

export function createTree(
  workspace: WorkspaceAtoms,
  treeSelection: TreeSelection,
  options: {syncRouteExpansion?: boolean} = {}
): TreeAtoms {
  return new TreeAtomsImpl(workspace, treeSelection, options)
}
