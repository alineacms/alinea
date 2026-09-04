import type {EntryStatus} from '#/core/Entry.js'
import type {Config} from '#/core/Config.js'
import {Permission} from '#/core/Role.js'
import type {RootData, RootI18n} from '#/core/Root.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import type {
  DragItem,
  DragTypes,
  DropOperation,
  DropTarget
} from '@react-types/shared'
import {
  createExplorerAtoms,
  type ExplorerAtoms
} from '#/dashboard/atoms/explorer.js'
import {type Atom, atom, type PrimitiveAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {ComponentType, SetStateAction} from 'react'
import type {
  DroppableCollectionInsertDropEvent,
  DroppableCollectionOnItemDropEvent,
  DroppableCollectionReorderEvent,
  Key
} from 'react-aria-components'
import {LucideFile} from '../icons.js'
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
import {pageAtom} from './nav.js'
import {policyAtom} from './user.js'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDragItem,
  dashboardEntryDragTypes,
  dispense
} from './utils.js'

export interface RootViewProps {
  root: RootData
}

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
  dragDisabled: boolean
}

export interface RootTreeNode {
  id: string
  children: Array<RootTreeNode>
}

export interface TreeSnapshot {
  expandedKeys: Set<string>
  items: Array<RootTreeNode>
  selectedKeys: Set<string>
}

interface TreeSource {
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

function rootTreeItem(
  config: Config,
  entry: TreeEntrySummary,
  parentType: string | null
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
    dragDisabled: Boolean(
      parentType && getType(config.schema[parentType]).orderChildrenBy
    )
  }
}

export class TreeAtoms {
  expandedKeys: PrimitiveAtom<Set<string>>
  collapsedKeys: PrimitiveAtom<TreeCollapseState>
  #root: RootAtoms
  #locale: string | null
  #selectedKeys: Atom<Set<Key>>

  constructor(
    root: RootAtoms,
    locale: string | null,
    selectedKeys: Atom<Set<Key>>,
    viewState?: TreeViewState
  ) {
    this.#root = root
    this.#locale = locale
    this.#selectedKeys = selectedKeys
    this.expandedKeys = viewState?.expandedKeys ?? atom(new Set<string>())
    this.collapsedKeys =
      viewState?.collapsedKeys ??
      atom<TreeCollapseState>({
        selectedId: undefined,
        keys: new Set<string>()
      })
  }

  #source = atom(async get => {
    const config = get(configAtom)
    const selectedKeys = new Set([...get(this.#selectedKeys)].map(String))
    const selectedId = [...selectedKeys][0]
    const selectedModel = selectedId ? treeEntryAtoms(selectedId) : undefined
    let selected: TreeEntrySummary | undefined
    try {
      selected = selectedModel
        ? await get(selectedModel.summary(this.#locale))
        : undefined
    } catch (error) {
      if (!(error instanceof MissingEntryError)) throw error
      selected = undefined
    }
    const parents =
      selectedModel && selected ? await get(selectedModel.parents) : []
    const models = new Map(parents.map(parent => [parent.id, parent]))
    if (selectedModel) models.set(selectedModel.id, selectedModel)
    const collapsed = get(this.collapsedKeys)
    const collapsedKeys =
      collapsed.selectedId === selectedId ? collapsed.keys : new Set<string>()
    const expandedKeys = new Set(get(this.expandedKeys))
    for (const parentId of selected?.parents ?? [])
      if (!collapsedKeys.has(parentId)) expandedKeys.add(parentId)

    const missingModels = await Promise.all(
      [...expandedKeys]
        .filter(id => !models.has(id))
        .map(id => get(treeEntryAtoms(id).ready))
    )
    for (const model of missingModels) models.set(model.id, model)

    const expandedModels = [...expandedKeys].flatMap(id => {
      const model = models.get(id)
      return model ? [model] : []
    })
    const [rootModels, childLevels, parentEntries] = await Promise.all([
      get(this.#root.treeEntries(this.#locale)),
      Promise.all(
        expandedModels.map(model => get(model.children(this.#locale)))
      ),
      Promise.all(expandedModels.map(model => get(model.raw(this.#locale))))
    ])
    const levels = [rootModels, ...childLevels]
    const parentTypes: Array<string | null> = [
      null,
      ...parentEntries.map(entry => entry.type)
    ]
    const levelItems = await Promise.all(
      levels.map((level, index) =>
        Promise.all(
          level.map(async model =>
            rootTreeItem(
              config,
              await get(model.summary(this.#locale)),
              parentTypes[index] ?? null
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
      snapshot: {expandedKeys, items: nested(null), selectedKeys}
    } satisfies TreeSource
  })

  #state = unwrap(this.#source, previous => previous)
  snapshot = atom(get => get(this.#state)?.snapshot ?? emptyTreeSnapshot)
  items = atom(get => [...(get(this.#state)?.entries.values() ?? [])])
  #itemSource = dispense((id: string) =>
    atom(async get => {
      const model = treeEntryAtoms(id)
      const entry = await get(model.summary(this.#locale))
      const config = get(configAtom)
      const parent = entry.parentId
        ? await get(treeEntryAtoms(entry.parentId).raw(this.#locale))
        : undefined
      return rootTreeItem(config, entry, parent?.type ?? null)
    })
  )
  children = dispense((id: string) => treeEntryAtoms(id).children(this.#locale))
  #itemState = dispense((id: string) =>
    unwrap(this.#itemSource(id), previous => previous)
  )
  item = dispense((id: string) =>
    atom(get => {
      const item = get(this.#itemState(id))
      if (item) return item
      const loaded = get(this.#state)?.entries.get(id)
      if (loaded) return loaded
      throw get(this.#itemSource(id))
    })
  )
  selectedItem = atom(get => {
    const state = get(this.#state)
    const selectedId = state && [...state.snapshot.selectedKeys][0]
    return selectedId ? state.entries.get(selectedId) : undefined
  })
  ready = atom(async get => {
    get(this.snapshot)
    const source = await get(this.#source)
    await Promise.all(
      [...source.entries.keys()].map(id => get(this.#itemSource(id)))
    )
    return source.snapshot
  })
}

export class RootAtoms {
  readonly data: Atom<RootData>
  readonly tree: (locale: string | null) => TreeAtoms
  explorer: ExplorerAtoms

  #explorerLocaleState = atom<string | null>(null)
  #explorerLocale = atom(
    get => {
      if (get(this.data).isMediaRoot) return null
      const page = get(pageAtom)
      return page.workspace === this.workspace && page.root === this.key
        ? page.locale
        : get(this.#explorerLocaleState)
    },
    (get, set, update: SetStateAction<string | null>) => {
      const page = get(pageAtom)
      const current =
        page.workspace === this.workspace && page.root === this.key
          ? page.locale
          : get(this.#explorerLocaleState)
      set(
        this.#explorerLocaleState,
        typeof update === 'function' ? update(current) : update
      )
    }
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

  createTree(
    locale: string | null,
    selectedKeys: Atom<Set<Key>>,
    expandedKeys?: PrimitiveAtom<Set<string>>
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
        : undefined
    )
  }

  treeEntries = dispense((locale: string | null) =>
    atom(async get => {
      get(shaAtom)
      const data = get(this.data)
      return loadTreeChildren(
        get,
        {workspace: this.workspace, root: this.key, parentId: null},
        locale,
        data.orderChildrenBy
      )
    })
  )

  children = dispense((parentId: string | null) =>
    createExplorerAtoms(
      {
        workspace: this.workspace,
        root: this.key,
        parentId: parentId ?? undefined
      },
      {
        defaultOrderBy:
          parentId === null
            ? atom(get => get(this.data).orderChildrenBy)
            : undefined,
        enableNavigation: true,
        rootData: this.data,
        selectedLocaleAtom: this.#explorerLocale,
        treeItems: locale => this.tree(locale).items,
        selectionBehavior: 'toggle',
        selectionMode: 'multiple'
      }
    )
  )

  label = atom(get => get(this.data).label)
  icon = atom(get => get(this.data).icon ?? LucideFile)
  i18n = atom((get): RootI18n | undefined => {
    const data = get(this.data)
    return data.isMediaRoot ? undefined : data.i18n
  })
  isMedia = atom(get => Boolean(get(this.data).isMediaRoot))
  canCreate = atom(get => {
    return get(policyAtom).canCreate({
      workspace: this.workspace,
      root: this.key
    })
  })
  view = atom((get): ComponentType<RootViewProps> | undefined => {
    const view = get(this.data).view
    if (!view) return undefined
    return typeof view === 'string'
      ? (get(viewAtoms(view)) as ComponentType<RootViewProps> | undefined)
      : view
  })
  acceptedDragTypes = [...dashboardEntryDragTypes]
  getItems = atom(null, (_get, _set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(dashboardEntryDragItem)
  })
  dragDisabled = atom(get => {
    const policy = get(policyAtom)
    const resource = {workspace: this.workspace, root: this.key}
    return !policy.canMove(resource) && !policy.canReorder(resource)
  })
  getDropOperation = atom(
    null,
    (
      _get,
      _set,
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
    async (
      get,
      _set,
      event: DroppableCollectionReorderEvent,
      tree: TreeAtoms
    ) => {
      const graph = get(graphAtom)
      const policy = get(policyAtom)
      const moveTarget = event.target.key ? String(event.target.key) : this.key
      const targetType = event.target.key ? 'entry' : 'root'
      for (const key of event.keys) {
        const id = String(key)
        const item = get(tree.item(id))
        if (item.dragDisabled) continue
        policy.assert(
          event.target.dropPosition === 'on'
            ? Permission.Move
            : Permission.Reorder,
          {
            workspace: this.workspace,
            root: this.key,
            id,
            type: item.type,
            locale: item.locale,
            parents: item.parents
          }
        )
        await graph.move({
          id,
          target: moveTarget,
          targetType,
          dropPosition: event.target.dropPosition
        })
      }
    }
  )
  onDrop = atom(
    null,
    async (
      get,
      _set,
      event:
        | DroppableCollectionInsertDropEvent
        | DroppableCollectionOnItemDropEvent
    ) => {
      const keys = new Set<Key>()
      for (const item of event.items) {
        if (item.kind !== 'text' || !item.types || !item.getText) continue
        let id: string | null = null
        if (item.types.has(dashboardEntryDragTypes[0]))
          id = await item.getText(dashboardEntryDragTypes[0])
        else if (item.types.has('text/plain'))
          id = await item.getText('text/plain')
        if (id) keys.add(id)
      }
      const graph = get(graphAtom)
      const moveTarget = event.target.key ? String(event.target.key) : this.key
      const targetType = event.target.key ? 'entry' : 'root'
      for (const key of keys) {
        const id = String(key)
        await graph.move({
          id,
          target: moveTarget,
          targetType,
          dropPosition: event.target.dropPosition
        })
      }
    }
  )
}

export const rootAtoms = dispense(
  (workspace: string, root: string) => new RootAtoms(workspace, root)
)
