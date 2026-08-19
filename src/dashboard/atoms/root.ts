import {Entry, type EntryStatus} from '#/core/Entry.js'
import {Permission} from '#/core/Role.js'
import type {RootData, RootI18n} from '#/core/Root.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {Type} from '#/core/Type.js'
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

const treeItemSelect = {
  id: Entry.id,
  title: Entry.title,
  type: Entry.type,
  status: Entry.status,
  main: Entry.main,
  locale: Entry.locale,
  parentId: Entry.parentId,
  parents: Entry.parents
}

function preferredLocaleEntries<
  Item extends {id: string; locale: string | null}
>(items: Array<Item>, locale: string | null): Array<Item> {
  const translated = new Set(
    items.filter(item => item.locale === locale).map(item => item.id)
  )
  const untranslated = new Set<string>()
  return items.filter(item => {
    if (translated.has(item.id)) return item.locale === locale
    if (untranslated.has(item.id)) return false
    untranslated.add(item.id)
    return true
  })
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
    get(shaAtom)
    const data = get(this.#root.data)
    const config = get(configAtom)
    const graph = get(graphAtom)
    const policy = get(policyAtom)
    const visibleTypes = Object.entries(config.schema)
      .filter(([, type]) => !Type.isHidden(type))
      .map(([name]) => name)
    const selectedKeys = new Set([...get(this.#selectedKeys)].map(String))
    const selectedId = [...selectedKeys][0]
    const requestedExpanded = get(this.expandedKeys)
    const metadataIds = new Set(requestedExpanded)
    if (selectedId) metadataIds.add(selectedId)
    const metadata =
      metadataIds.size === 0
        ? []
        : await graph.find({
            workspace: this.#root.workspace,
            root: this.#root.key,
            id: {in: [...metadataIds]},
            filter: {_type: {in: visibleTypes}},
            status: 'preferDraft',
            select: treeItemSelect
          })
    const metadataById = new Map(
      preferredLocaleEntries(
        metadata.filter(entry => policy.canRead(entry)),
        this.#locale
      ).map(entry => [entry.id, entry])
    )
    const selected = selectedId ? metadataById.get(selectedId) : undefined
    const collapsed = get(this.collapsedKeys)
    const collapsedKeys =
      collapsed.selectedId === selectedId ? collapsed.keys : new Set<string>()
    const expandedKeys = new Set(requestedExpanded)
    for (const parentId of selected?.parents ?? [])
      if (!collapsedKeys.has(parentId)) expandedKeys.add(parentId)

    const parentIds = new Set<string | null>([null, ...expandedKeys])
    const missingParentIds = [...parentIds].filter(
      (id): id is string => id !== null && !metadataById.has(id)
    )
    if (missingParentIds.length > 0) {
      const parents = await graph.find({
        workspace: this.#root.workspace,
        root: this.#root.key,
        id: {in: missingParentIds},
        filter: {_type: {in: visibleTypes}},
        status: 'preferDraft',
        select: treeItemSelect
      })
      for (const parent of preferredLocaleEntries(
        parents.filter(entry => policy.canRead(entry)),
        this.#locale
      ))
        metadataById.set(parent.id, parent)
    }

    const childLists = await Promise.all(
      [...parentIds].map(async parentId => {
        const parent =
          parentId === null ? undefined : metadataById.get(parentId)
        const entries = await graph.find({
          workspace: this.#root.workspace,
          root: this.#root.key,
          parentId,
          filter: {_type: {in: visibleTypes}},
          status: 'preferDraft',
          orderBy: parent
            ? getType(config.schema[parent.type]).orderChildrenBy
            : data.orderChildrenBy,
          select: treeItemSelect
        })
        return preferredLocaleEntries(
          entries.filter(entry => policy.canRead(entry)),
          this.#locale
        )
      })
    )
    const loadedEntries = childLists.flat()
    const possibleChildren =
      loadedEntries.length === 0
        ? []
        : await graph.find({
            workspace: this.#root.workspace,
            root: this.#root.key,
            parentId: {in: loadedEntries.map(entry => entry.id)},
            filter: {_type: {in: visibleTypes}},
            status: 'preferDraft',
            select: treeItemSelect
          })
    const entriesWithChildren = new Set(
      preferredLocaleEntries(
        possibleChildren.filter(entry => policy.canRead(entry)),
        this.#locale
      ).flatMap(entry => (entry.parentId ? [entry.parentId] : []))
    )
    const entries = new Map<string, RootTreeItem>()
    const children = new Map<string | null, Array<string>>()
    for (const entry of loadedEntries) {
      const parent = entry.parentId
        ? metadataById.get(entry.parentId)
        : undefined
      entries.set(entry.id, {
        ...entry,
        dragDisabled: Boolean(
          parent && getType(config.schema[parent.type]).orderChildrenBy
        ),
        hasChildren: entriesWithChildren.has(entry.id)
      })
      const ids = children.get(entry.parentId) ?? []
      ids.push(entry.id)
      children.set(entry.parentId, ids)
    }
    function nested(parentId: string | null): Array<RootTreeNode> {
      return (children.get(parentId) ?? []).map(id => ({
        id,
        children: nested(id)
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
      const loaded = (await get(this.#source)).entries.get(id)
      if (loaded) return loaded
      const config = get(configAtom)
      const graph = get(graphAtom)
      const policy = get(policyAtom)
      const visibleTypes = Object.entries(config.schema)
        .filter(([, type]) => !Type.isHidden(type))
        .map(([name]) => name)
      const matches = await graph.find({
        workspace: this.#root.workspace,
        root: this.#root.key,
        id,
        filter: {_type: {in: visibleTypes}},
        status: 'preferDraft',
        select: treeItemSelect
      })
      const entry = preferredLocaleEntries(
        matches.filter(match => policy.canRead(match)),
        this.#locale
      )[0]
      if (!entry) throw new Error(`Tree item "${id}" not found`)
      const parent = entry.parentId
        ? await graph.first({
            workspace: this.#root.workspace,
            root: this.#root.key,
            id: entry.parentId,
            status: 'preferDraft',
            select: {type: Entry.type}
          })
        : undefined
      const children = await graph.find({
        workspace: this.#root.workspace,
        root: this.#root.key,
        parentId: id,
        filter: {_type: {in: visibleTypes}},
        status: 'preferDraft',
        select: treeItemSelect
      })
      return {
        ...entry,
        dragDisabled: Boolean(
          parent && getType(config.schema[parent.type]).orderChildrenBy
        ),
        hasChildren:
          preferredLocaleEntries(
            children.filter(child => policy.canRead(child)),
            this.#locale
          ).length > 0
      }
    })
  )
  #itemState = dispense((id: string) =>
    unwrap(this.#itemSource(id), previous => previous)
  )
  item = dispense((id: string) =>
    atom(get => {
      const loaded = get(this.#state)?.entries.get(id)
      if (loaded) return loaded
      const item = get(this.#itemState(id))
      if (!item) throw get(this.#itemSource(id))
      return item
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
      [...source.entries].map(([id]) => get(this.#itemSource(id)))
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
        selectedLocaleAtom:
          parentId === null ? this.#explorerLocale : undefined,
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
