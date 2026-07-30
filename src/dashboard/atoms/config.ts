import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {Order} from '#/core/Graph.js'
import {getRoot, getWorkspace} from '#/core/Internal.js'
import {Permission} from '#/core/Role.js'
import {Root as ConfigRoot, type RootData, type RootI18n} from '#/core/Root.js'
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
import type {Atom, Getter, Setter} from 'jotai'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {ComponentType, SetStateAction} from 'react'
import type {
  DroppableCollectionInsertDropEvent,
  DroppableCollectionOnItemDropEvent,
  DroppableCollectionReorderEvent,
  Key
} from 'react-aria-components'
import {LucideFile} from '../icons.js'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDragItem,
  dashboardEntryDragType,
  dashboardEntryDragTypes,
  dispense,
  requiredAtom,
  swr
} from './utils.js'
import {entryAtoms, type EntryAtoms} from './entry.js'
import {graphAtom, shaAtom} from './graph.js'
import {routeAtom} from './routing.js'
import {policyAtom} from './user.js'
import {
  ExplorerAtoms,
  type ExplorerLocation,
  loadEntryData
} from './explorer.js'
import {selectedRootAtom, selectedWorkspaceAtom} from './routing.js'

export const configAtom = requiredAtom<Config>('dashboard.config')
export const viewsAtom = atom<Record<string, ComponentType>>({})

function readWorkspace(get: Getter, key: string) {
  const workspace = get(configAtom).workspaces[key]
  assert(workspace, `Workspace "${key}" not found in config`)
  return getWorkspace(workspace)
}

export const workspacesAtom = atom(get => {
  const config = get(configAtom)
  const policy = get(policyAtom)
  return Object.keys(config.workspaces).filter(workspace =>
    policy.canRead({workspace})
  )
})

export class WorkspaceAtoms {
  tree: TreeAtoms
  settings: Atom<ReturnType<typeof getWorkspace>>
  roots: Atom<Array<string>>
  root: (key: string) => RootAtoms
  rootMenu: Atom<
    Array<{id: string; label: string; icon: ComponentType | undefined}>
  >

  constructor(public key: string) {
    this.settings = atom(get => readWorkspace(get, key))
    this.roots = atom(get => {
      const configuredRoots = readWorkspace(get, key).roots
      const policy = get(policyAtom)
      return Object.keys(configuredRoots).filter(root =>
        policy.canRead({workspace: key, root})
      )
    })
    this.root = dispense(rootKey => new RootAtoms(this, rootKey))
    this.rootMenu = atom(get => {
      return get(this.roots).map(rootKey => ({
        id: rootKey,
        label: get(this.root(rootKey).settings).label,
        icon: get(this.root(rootKey).icon)
      }))
    })
    this.tree = new TreeAtoms(this)
  }
}

export const workspaceAtoms = dispense((key: string) => {
  assert(key, 'Workspace key cannot be empty')
  return new WorkspaceAtoms(key)
})

export const currentWorkspaceAtom = atom(get => {
  const workspace = get(selectedWorkspaceAtom)
  return workspace ? workspaceAtoms(workspace) : null
})

export const selectedMediaRootAtom = atom(get => {
  const workspace = get(currentWorkspaceAtom)
  if (!workspace) return null
  const roots = get(workspace.roots)
  return (
    roots.find(root => get(workspace.root(root).settings).isMediaRoot) ?? null
  )
})

export const currentRootAtom = atom(get => {
  const workspace = get(currentWorkspaceAtom)
  const root = get(selectedRootAtom)
  if (!workspace || !root) return null
  return workspace.root(root)
})

export interface TreeSnapshot {
  items: Array<EntryAtoms>
  children: ReadonlyMap<string, Array<EntryAtoms>>
}

const emptyTreeSnapshot: TreeSnapshot = {
  items: [],
  children: new Map()
}

interface PreparedTreeSnapshot {
  resource: Promise<TreeSnapshot>
  snapshot: TreeSnapshot
}

export class TreeAtoms {
  constructor(private workspace: WorkspaceAtoms) {}

  expandedKeys = atom(new Set<Key>())
  setExpandedKeys = atom(
    null,
    async (get, set, next: Set<Key>): Promise<void> => {
      const current = get(this.expandedKeys)
      const opening = [...next].filter(key => !current.has(key))
      await Promise.all(
        opening.map(async key => {
          const data = await loadEntryData(get, entryAtoms(String(key)))
          if (!data) return
          const childIds = await get(data.children)
          await Promise.all(
            childIds.map(id => loadEntryData(get, entryAtoms(id)))
          )
        })
      )
      set(this.expandedKeys, next)
    }
  )
  expand = atom(null, async (get, set, key: Key): Promise<void> => {
    const expanded = get(this.expandedKeys)
    if (expanded.has(key)) return
    const next = new Set(expanded)
    next.add(key)
    await set(this.setExpandedKeys, next)
  })
  #snapshotResource = dispense((root: RootAtoms) =>
    dispense((locale: string | null) =>
      atom(async get => {
        const expanded = get(this.expandedKeys)
        const rootIds = await queryTreeChildren(
          get,
          root,
          null,
          get(root.settings).orderChildrenBy,
          locale
        )
        const items = rootIds.map(entryAtoms)
        const children = new Map<string, Array<EntryAtoms>>()
        async function loadVisible(entries: Array<EntryAtoms>): Promise<void> {
          await Promise.all(
            entries.map(async entry => {
              const {data} = await get(entry.readyState)
              if (!data || !get(data.entryData).hasChildren) return
              const childIds = await queryTreeChildren(
                get,
                root,
                entry.id,
                get(data.orderChildrenBy),
                locale
              )
              const childEntries = childIds.map(entryAtoms)
              children.set(entry.id, childEntries)
              if (expanded.has(entry.id)) await loadVisible(childEntries)
            })
          )
        }
        await loadVisible(items)
        return {items, children} satisfies TreeSnapshot
      })
    )
  )
  #preparedSnapshot = dispense((_root: RootAtoms) =>
    dispense((_locale: string | null) => atom<PreparedTreeSnapshot>())
  )
  #snapshotValue = dispense((root: RootAtoms) =>
    dispense((locale: string | null) => {
      const resourceAtom = this.#snapshotResource(root)(locale)
      const preparedAtom = this.#preparedSnapshot(root)(locale)
      const liveSnapshot = unwrap(resourceAtom, previous => previous)
      return atom(get => {
        const resource = get(resourceAtom)
        const prepared = get(preparedAtom)
        if (prepared?.resource === resource) return prepared.snapshot
        return get(liveSnapshot) ?? emptyTreeSnapshot
      })
    })
  )
  snapshot = dispense((root: RootAtoms) =>
    atom(get => get(this.#snapshotValue(root)(get(root.selectedLocale))))
  )

  async prepareSnapshot(
    get: Getter,
    set: Setter,
    root: RootAtoms,
    locale: string | null
  ): Promise<void> {
    const resource = get(this.#snapshotResource(root)(locale))
    const snapshot = await resource
    set(this.#preparedSnapshot(root)(locale), {resource, snapshot})
  }

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

  getItems(keys: Set<Key>): Array<DragItem> {
    return [...keys].map(id => dashboardEntryDragItem(id))
  }

  dragDisabled = atom(get => {
    if (get(selectedWorkspaceAtom) !== this.workspace.key) return true
    const root = get(selectedRootAtom)
    if (!root) return true
    const policy = get(policyAtom)
    const resource = {workspace: this.workspace.key, root}
    return !policy.canMove(resource) && !policy.canReorder(resource)
  })

  getDropOperation(
    _target: DropTarget,
    types: DragTypes,
    allowedOperations: Array<DropOperation>
  ): DropOperation {
    if (!acceptsDashboardEntryDrag(types)) return 'cancel'
    return allowedOperations.includes('move') ? 'move' : 'cancel'
  }

  onMove = atom(
    null,
    async (get, _set, event: DroppableCollectionReorderEvent) => {
      await this.#moveDraggedKeys(get, event.keys, event.target)
    }
  )

  onInsert = atom(
    null,
    async (get, _set, event: DroppableCollectionInsertDropEvent) => {
      await this.#moveDropItems(get, event.items, event.target)
    }
  )

  onItemDrop = atom(
    null,
    async (get, _set, event: DroppableCollectionOnItemDropEvent) => {
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

const pendingExplorerParent = new Promise<string | undefined>(() => {})

export class RootAtoms {
  explorer: ExplorerAtoms
  constructor(
    public workspace: WorkspaceAtoms,
    public key: string
  ) {
    const selectedParent = unwrap(
      atom(get => {
        const route = get(routeAtom)
        if (
          route.workspace === workspace.key &&
          route.root === key &&
          route.entry
        ) {
          const {data} = get(entryAtoms(route.entry).data)
          if (data && get(data.view) === 'overview') return route.entry
          return pendingExplorerParent
        }
        return undefined
      }),
      previous => previous
    )
    this.explorer = new ExplorerAtoms(
      atom(
        get => {
          return {
            workspace: workspace.key,
            root: key,
            parentId: get(selectedParent)
          }
        },
        (get, set, update: SetStateAction<ExplorerLocation>) => {
          const next =
            typeof update === 'function'
              ? update(get(this.explorer.location))
              : update
          if (next.root !== key || next.workspace !== workspace.key) {
            set(routeAtom, {
              workspace: next.workspace,
              root: next.root
            })
          } else {
            const route = get(routeAtom)
            const selectedWorkspace = get(selectedWorkspaceAtom)
            const selectedRoot = get(selectedRootAtom)
            if (selectedWorkspace === workspace.key && selectedRoot === key)
              set(routeAtom, {
                workspace: workspace.key,
                root: key,
                entry: next.parentId,
                locale: route.locale
              })
            if (next.parentId) {
              const expanded = new Set(get(workspace.tree.expandedKeys))
              expanded.add(next.parentId)
              set(workspace.tree.expandedKeys, expanded)
            }
          }
        }
      ),
      {
        selectionMode: 'multiple',
        selectionBehavior: 'toggle',
        onAction: atom(null, (get, set, entry) => {
          set(routeAtom, {
            workspace: this.workspace.key,
            root: this.key,
            entry: entry.id
          })
        })
      }
    )
  }

  settings = atom(get => {
    const config = get(configAtom)
    const workspaceConfig = config.workspaces[this.workspace.key]
    assert(
      workspaceConfig,
      `Workspace "${this.workspace.key}" not found in config`
    )
    const rootConfig = workspaceConfig[this.key]
    return getRoot(rootConfig)
  })

  selected = atom(
    get => {
      const route = get(routeAtom)
      if (route.page === 'users') return false
      if (get(selectedWorkspaceAtom) !== this.workspace.key) return false
      return get(selectedRootAtom) === this.key
    },
    (get, set, value: boolean) => {
      set(
        routeAtom,
        value ? {workspace: this.workspace.key, root: this.key} : {}
      )
    }
  )

  #languagePreference = atom<string>()
  selectedLocale = atom(
    get => {
      const route = get(routeAtom)
      const i18n = get(this.settings).i18n
      if (route.locale && i18n?.locales.includes(route.locale))
        return route.locale
      const preference = get(this.#languagePreference)
      if (preference) return preference
      return i18n?.locales[0] ?? null
    },
    async (get, set, locale: string) => {
      const route = get(routeAtom)
      const changed = await set(routeAtom, {
        workspace: this.workspace.key,
        root: this.key,
        entry: route.entry,
        locale
      })
      if (changed) set(this.#languagePreference, locale)
    }
  )

  icon = atom(get => get(this.settings).icon ?? LucideFile)
  mediaI18n = atom((get): RootI18n | undefined => {
    return ConfigRoot.mediaI18n(get(this.settings))
  })
  data = atom((get): RootData & {name: string} => ({
    name: this.key,
    ...get(this.settings)
  }))
  view = atom((get): ComponentType<{root: RootData}> | undefined => {
    const view = get(this.settings).view
    if (!view) return undefined
    if (typeof view === 'string')
      return get(viewsAtom)[view] as ComponentType<{root: RootData}> | undefined
    return view
  })
  canCreate = atom(get => {
    const policy = get(policyAtom)
    return policy.canCreate({
      workspace: this.workspace.key,
      root: this.key
    })
  })
  childrenFor = dispense((locale: string | null) => {
    return swr(
      atom(get =>
        queryTreeChildren(
          get,
          this,
          null,
          get(this.settings).orderChildrenBy,
          locale
        )
      )
    )
  })
  children = atom(get => get(this.childrenFor(get(this.selectedLocale))))

  hasChildren = atom(async get => {
    const db = get(graphAtom)
    const visibleTypes = get(this.workspace.tree.visibleTypes)
    const policy = get(policyAtom)
    const children = await db.find({
      workspace: this.workspace.key,
      root: this.key,
      parentId: null,
      filter: {_type: {in: visibleTypes}},
      select: {
        id: Entry.id,
        type: Entry.type,
        workspace: Entry.workspace,
        root: Entry.root,
        parents: Entry.parents,
        locale: Entry.locale
      },
      status: 'preferDraft'
    })
    return children.some(child => policy.canRead(child))
  })
}

export async function queryTreeChildren(
  get: Getter,
  root: RootAtoms,
  parentId: null | string,
  orderBy: Order | Array<Order> | undefined,
  locale: string | null
) {
  get(shaAtom)
  const visibleTypes = get(root.workspace.tree.visibleTypes)
  const db = get(graphAtom)
  const policy = get(policyAtom)
  const children = await db.find({
    select: {
      id: Entry.id,
      type: Entry.type,
      workspace: Entry.workspace,
      root: Entry.root,
      parents: Entry.parents,
      locale: Entry.locale
    },
    orderBy,
    workspace: root.workspace.key,
    root: root.key,
    parentId,
    filter: {
      _type: {in: visibleTypes}
    },
    status: 'preferDraft'
  })
  const readableChildren = children.filter(child => policy.canRead(child))
  const translatedChildren = new Set(
    readableChildren
      .filter(child => child.locale === locale)
      .map(child => child.id)
  )
  const untranslated = new Set()
  const orderedChildren = readableChildren.filter(child => {
    if (translatedChildren.has(child.id)) return child.locale === locale
    if (untranslated.has(child.id)) return false
    untranslated.add(child.id)
    return true
  })
  const ids = [...new Set(orderedChildren.map(child => child.id))]
  return ids
}
