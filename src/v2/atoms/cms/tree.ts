import {Config} from 'alinea/core/Config'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {Entry, type EntryStatus} from 'alinea/core/Entry'
import {getType} from 'alinea/core/Internal'
import type {OrderBy} from 'alinea/core/OrderBy'
import {Root} from 'alinea/core/Root'
import {Type} from 'alinea/core/Type'
import {Workspace} from 'alinea/core/Workspace'
import {atom} from 'jotai'
import {atomWithReducer} from 'jotai/utils'
import {cmsRouteAtom, type CmsRoute} from './route.js'
import {currentWorkspaceAtom} from './workspaces.js'
import {configAtom} from '../config.js'
import {graphAtom} from '../graph.js'
import {command} from '../util/Command.js'

export interface TreeNode {
  id: string
  parentId: string | null
  kind: 'root' | 'entry'
  workspace: string
  root: string
  title: string
  entryId?: string
  typeName?: string
  isContainer?: boolean
  hasChildNodes: boolean
  entryStatus?: EntryStatus
  isUnpublished?: boolean
}

export interface TreeEntryPreview {
  id: string
  title: string
  typeName: string
  isContainer: boolean
  hasChildren: boolean
  status: EntryStatus
  isUnpublished: boolean
}

export interface TreeItem {
  id: string
  textValue: string
  hasChildNodes: boolean
  children?: Array<TreeItem>
  node: TreeNode
}

export interface TreeView {
  focusItem: TreeItem | null
  items: Array<TreeItem>
}

export interface TreeSnapshot {
  expandedKeys: Set<string>
  selectedKeys: Set<string>
  itemIndex: Map<string, TreeItem>
  focusItem: TreeItem | null
  items: Array<TreeItem>
}

export interface TreeDropTarget {
  key: string
  dropPosition: 'on' | 'before' | 'after'
}

interface ResolvedTreeDropTarget {
  parentNodeId: string
  targetNodeId: string
  dropPosition: 'on' | 'before' | 'after'
}

interface EntryRouteInfo {
  id: string
  parentId: string | null
  hasChildren: boolean
}

interface TreeState {
  expandedKeys: Set<string>
  selectedNodeId: string | null
  focusedNodeId: string | null
  rootHasChildrenById: Record<string, boolean>
  childIdsByParent: Record<string, Array<string>>
  nodesById: Record<string, TreeNode>
  loadingByNodeId: Record<string, boolean>
}

interface TreeAction {
  type:
    | 'setExpandedKeys'
    | 'addExpandedKeys'
    | 'setSelectedNodeId'
    | 'setFocusedNodeId'
    | 'mergeRootHasChildren'
    | 'setNodeChildren'
    | 'setNodeLoading'
    | 'resetLoadedNodes'
  keys?: Set<string>
  nodeId?: string | null
  rootHasChildrenById?: Record<string, boolean>
  children?: Array<TreeNode>
  isLoading?: boolean
}

function createInitialTreeState(): TreeState {
  return {
    expandedKeys: new Set<string>(),
    selectedNodeId: null,
    focusedNodeId: null,
    rootHasChildrenById: {},
    childIdsByParent: {},
    nodesById: {},
    loadingByNodeId: {}
  }
}

function reduceTreeState(state: TreeState, action: TreeAction): TreeState {
  switch (action.type) {
    case 'setExpandedKeys': {
      if (!action.keys) return state
      return {
        ...state,
        expandedKeys: new Set(action.keys)
      }
    }
    case 'addExpandedKeys': {
      if (!action.keys || action.keys.size === 0) return state
      const nextKeys = new Set(state.expandedKeys)
      for (const key of action.keys) nextKeys.add(key)
      return {
        ...state,
        expandedKeys: nextKeys
      }
    }
    case 'setSelectedNodeId': {
      return {
        ...state,
        selectedNodeId: action.nodeId ?? null
      }
    }
    case 'setFocusedNodeId': {
      return {
        ...state,
        focusedNodeId: action.nodeId ?? null
      }
    }
    case 'mergeRootHasChildren': {
      if (!action.rootHasChildrenById) return state
      return {
        ...state,
        rootHasChildrenById: {
          ...state.rootHasChildrenById,
          ...action.rootHasChildrenById
        }
      }
    }
    case 'setNodeChildren': {
      if (!action.nodeId || !action.children) return state
      const nodesById = {...state.nodesById}
      for (const child of action.children) nodesById[child.id] = child
      return {
        ...state,
        childIdsByParent: {
          ...state.childIdsByParent,
          [action.nodeId]: action.children.map(child => child.id)
        },
        nodesById
      }
    }
    case 'setNodeLoading': {
      if (!action.nodeId || typeof action.isLoading !== 'boolean') return state
      return {
        ...state,
        loadingByNodeId: {
          ...state.loadingByNodeId,
          [action.nodeId]: action.isLoading
        }
      }
    }
    case 'resetLoadedNodes': {
      return {
        ...state,
        rootHasChildrenById: {},
        childIdsByParent: {},
        nodesById: {},
        loadingByNodeId: {}
      }
    }
    default: {
      return state
    }
  }
}

const treeStateAtom = atomWithReducer(createInitialTreeState(), reduceTreeState)

const workspaceRootNodesAtom = atom(get => {
  const config = get(configAtom)
  const workspace = get(currentWorkspaceAtom)
  const state = get(treeStateAtom)
  const workspaceConfig = config.workspaces[workspace]
  if (!workspaceConfig) return []
  return Object.entries(Workspace.roots(workspaceConfig)).map(
    ([rootName, root]) => {
      const rootId = `root:${workspace}:${rootName}`
      return buildRootNode(
        workspace,
        rootName,
        String(Root.label(root)),
        state.rootHasChildrenById[rootId] ?? true
      )
    }
  )
})

const defaultExpandedRootIdsAtom = atom(get => {
  const config = get(configAtom)
  const workspace = get(currentWorkspaceAtom)
  const workspaceConfig = config.workspaces[workspace]
  if (!workspaceConfig) return []
  return Object.entries(Workspace.roots(workspaceConfig))
    .filter(([, root]) => Boolean(Root.data(root).openByDefault))
    .map(([rootName]) => `root:${workspace}:${rootName}`)
})

const treeNodeIndexAtom = atom(get => {
  const index = new Map<string, TreeNode>()
  const roots = get(workspaceRootNodesAtom)
  for (const root of roots) index.set(root.id, root)
  for (const [id, node] of Object.entries(get(treeStateAtom).nodesById)) {
    index.set(id, node)
  }
  return index
})

const treeSelectedNodeIdAtom = atom(get => {
  const selectedNodeId = get(treeStateAtom).selectedNodeId
  if (!selectedNodeId) return null
  return get(treeNodeIndexAtom).has(selectedNodeId) ? selectedNodeId : null
})

export const treeSelectedKeysAtom = atom(
  get => {
    const selectedNodeId = get(treeSelectedNodeIdAtom)
    if (!selectedNodeId) return new Set<string>()
    return new Set<string>([selectedNodeId])
  },
  (_get, set, keys: Set<string>) => {
    const nodeId = keys.values().next().value
    set(treeStateAtom, {
      type: 'setSelectedNodeId',
      nodeId: nodeId ? String(nodeId) : null
    })
  }
)

export const treeFocusedNodeIdAtom = atom(
  get => {
    const focusedNodeId = get(treeStateAtom).focusedNodeId
    if (!focusedNodeId) return null
    return get(treeNodeIndexAtom).has(focusedNodeId) ? focusedNodeId : null
  },
  (_get, set, nodeId: string | null) => {
    set(treeStateAtom, {type: 'setFocusedNodeId', nodeId})
  }
)

const buildRootNode = (
  workspace: string,
  rootName: string,
  rootLabel: string,
  hasChildNodes: boolean
): TreeNode => {
  return {
    id: `root:${workspace}:${rootName}`,
    parentId: null,
    kind: 'root',
    workspace,
    root: rootName,
    title: rootLabel,
    hasChildNodes
  }
}

const buildEntryNode = (parent: TreeNode, entry: TreeEntryPreview): TreeNode => {
  return {
    id: `entry:${entry.id}`,
    parentId: parent.id,
    kind: 'entry',
    workspace: parent.workspace,
    root: parent.root,
    title: entry.title,
    entryId: entry.id,
    typeName: entry.typeName,
    isContainer: entry.isContainer,
    hasChildNodes: entry.hasChildren,
    entryStatus: entry.status,
    isUnpublished: entry.isUnpublished
  }
}

const visibleTypes = (config: Config): Array<string> => {
  return Object.entries(config.schema)
    .filter(([, type]) => !Type.isHidden(type))
    .map(([name]) => name)
}

const getHasChildren = async (
  graph: WriteableGraph,
  workspace: string,
  root: string,
  parentId: string | null,
  typeNames: Array<string>
) => {
  return Boolean(
    await graph.first({
      workspace,
      root,
      parentId,
      filter: {_type: {in: typeNames}},
      status: 'preferDraft'
    })
  )
}

const queryChildren = async (
  graph: WriteableGraph,
  config: Config,
  workspace: string,
  root: string,
  parentId: string | null,
  orderBy: OrderBy | Array<OrderBy> | undefined
): Promise<Array<TreeEntryPreview>> => {
  const typeNames = visibleTypes(config)
  if (typeNames.length === 0) return []
  const rows = await graph.find({
    select: {
      id: Entry.id,
      title: Entry.title,
      type: Entry.type,
      status: Entry.status,
      main: Entry.main
    },
    workspace,
    root,
    parentId,
    filter: {_type: {in: typeNames}},
    orderBy,
    status: 'preferDraft'
  })
  const uniqueById = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    if (!uniqueById.has(row.id)) uniqueById.set(row.id, row)
  }
  return Promise.all(
    Array.from(uniqueById.values()).map(async row => {
      const type = config.schema[row.type]
      const canContain = type ? Type.isContainer(type) : false
      const hasChildren = canContain
        ? await getHasChildren(graph, workspace, root, row.id, typeNames)
        : false
      return {
        id: row.id,
        title: row.title || '(Untitled)',
        typeName: row.type,
        isContainer: canContain,
        hasChildren,
        status: row.status,
        isUnpublished: row.status === 'draft' && row.main
      }
    })
  )
}

const queryRootEntries = async (
  graph: WriteableGraph,
  config: Config,
  workspace: string,
  root: string
) => {
  const rootConfig = config.workspaces[workspace]?.[root]
  const orderBy = rootConfig ? Root.data(rootConfig).orderChildrenBy : undefined
  return queryChildren(graph, config, workspace, root, null, orderBy)
}

const queryEntryChildren = async (
  graph: WriteableGraph,
  config: Config,
  workspace: string,
  root: string,
  parentEntryId: string
) => {
  const parent = await graph.first({
    id: parentEntryId,
    select: {type: Entry.type},
    status: 'preferDraft'
  })
  const parentType = parent ? config.schema[parent.type] : undefined
  const orderBy = parentType ? getType(parentType).orderChildrenBy : undefined
  return queryChildren(graph, config, workspace, root, parentEntryId, orderBy)
}

const queryEntryByRoute = async (
  graph: WriteableGraph,
  config: Config,
  route: CmsRoute
): Promise<EntryRouteInfo | null> => {
  if (!route.workspace || !route.root || !route.entry) return null
  const byId = await graph.first({
    workspace: route.workspace,
    root: route.root,
    id: route.entry,
    select: {
      id: Entry.id,
      parentId: Entry.parentId
    },
    status: 'preferDraft'
  })
  const byPath =
    byId ??
    (await graph.first({
      workspace: route.workspace,
      root: route.root,
      path: route.entry,
      select: {
        id: Entry.id,
        parentId: Entry.parentId
      },
      status: 'preferDraft'
    }))
  if (!byPath) return null
  const typeNames = visibleTypes(config)
  const hasChildren = await getHasChildren(
    graph,
    route.workspace,
    route.root,
    byPath.id,
    typeNames
  )
  return {
    id: byPath.id,
    parentId: byPath.parentId,
    hasChildren
  }
}

const queryParentIdByEntryId = async (
  graph: WriteableGraph,
  entryId: string
): Promise<string | null> => {
  const parent = await graph.first({
    id: entryId,
    select: {parentId: Entry.parentId},
    status: 'preferDraft'
  })
  return parent?.parentId ?? null
}

const queryAncestorIds = async (
  graph: WriteableGraph,
  targetEntryId: string
): Promise<Array<string>> => {
  const ancestry: Array<string> = []
  let parentId = await queryParentIdByEntryId(graph, targetEntryId)
  while (parentId) {
    ancestry.unshift(parentId)
    parentId = await queryParentIdByEntryId(graph, parentId)
  }
  return ancestry
}

function entryNodeId(entryId: string): string {
  return `entry:${entryId}`
}

function entryIdFromNodeId(nodeId: string): string | null {
  if (!nodeId.startsWith('entry:')) return null
  return nodeId.slice('entry:'.length)
}

function resolveTreeDropTarget(
  itemIndex: Map<string, TreeItem>,
  target: TreeDropTarget
): ResolvedTreeDropTarget | null {
  const targetItem = itemIndex.get(target.key)
  if (!targetItem) return null

  if (target.dropPosition === 'on') {
    if (targetItem.node.kind === 'entry' && !targetItem.node.isContainer) {
      return null
    }
    return {
      parentNodeId: targetItem.id,
      targetNodeId: targetItem.id,
      dropPosition: target.dropPosition
    }
  }

  if (targetItem.node.kind === 'root' || !targetItem.node.parentId) return null

  return {
    parentNodeId: targetItem.node.parentId,
    targetNodeId: targetItem.id,
    dropPosition: target.dropPosition
  }
}

function orderedChildren(
  config: Config,
  itemIndex: Map<string, TreeItem>,
  parentNodeId: string
): OrderBy | Array<OrderBy> | undefined {
  const parent = itemIndex.get(parentNodeId)?.node
  if (!parent) return undefined

  if (parent.kind === 'root') {
    const rootConfig = config.workspaces[parent.workspace]?.[parent.root]
    return rootConfig ? Root.data(rootConfig).orderChildrenBy : undefined
  }

  if (!parent.typeName) return undefined
  const parentType = config.schema[parent.typeName]
  return parentType ? getType(parentType).orderChildrenBy : undefined
}

export function canDragTreeItem(
  config: Config,
  itemIndex: Map<string, TreeItem>,
  nodeId: string
): boolean {
  const item = itemIndex.get(nodeId)
  if (!item || item.node.kind !== 'entry') return false
  const parentNodeId = item.node.parentId
  if (!parentNodeId) return false
  const parent = itemIndex.get(parentNodeId)?.node
  if (!parent) return false
  if (parent.kind === 'root') return true
  return !orderedChildren(config, itemIndex, parentNodeId)
}

export function canDropTreeItem(
  config: Config,
  itemIndex: Map<string, TreeItem>,
  nodeId: string,
  target: TreeDropTarget
): boolean {
  const item = itemIndex.get(nodeId)
  if (!item || item.node.kind !== 'entry' || !item.node.typeName) return false
  const childType = config.schema[item.node.typeName]
  if (!childType) return false

  const resolved = resolveTreeDropTarget(itemIndex, target)
  if (!resolved) return false

  const parent = itemIndex.get(resolved.parentNodeId)?.node
  if (!parent) return false

  const newParent = item.node.parentId !== parent.id
  if (!newParent) return !orderedChildren(config, itemIndex, parent.id)

  if (parent.kind === 'root') {
    const rootConfig = config.workspaces[parent.workspace]?.[parent.root]
    return rootConfig ? Config.rootContains(config, rootConfig, childType) : false
  }

  if (!parent.typeName) return false
  const parentType = config.schema[parent.typeName]
  return parentType ? Config.typeContains(config, parentType, childType) : false
}

export function treeDropOperation(
  config: Config,
  itemIndex: Map<string, TreeItem>,
  nodeId: string | null,
  target: TreeDropTarget
): 'move' | 'cancel' {
  if (!nodeId) return 'cancel'
  return canDropTreeItem(config, itemIndex, nodeId, target)
    ? 'move'
    : 'cancel'
}

async function queryTreeChildIds(
  graph: WriteableGraph,
  config: Config,
  node: TreeNode
): Promise<Array<string>> {
  const entries =
    node.kind === 'root'
      ? await queryRootEntries(graph, config, node.workspace, node.root)
      : node.entryId
        ? await queryEntryChildren(graph, config, node.workspace, node.root, node.entryId)
        : []
  return entries.map(entry => entryNodeId(entry.id))
}

export const loadTreeNodeChildrenCommand = command<[string], Promise<void>>(
  async (get, set, nodeId) => {
    const node = get(treeNodeIndexAtom).get(nodeId)
    if (!node || !node.hasChildNodes) return
    if (get(treeStateAtom).childIdsByParent[nodeId]) return

    set(treeStateAtom, {type: 'setNodeLoading', nodeId, isLoading: true})

    try {
      const graph = get(graphAtom)
      const config = get(configAtom)
      const entries =
        node.kind === 'root'
          ? await queryRootEntries(graph, config, node.workspace, node.root)
          : node.entryId
            ? await queryEntryChildren(
                graph,
                config,
                node.workspace,
                node.root,
                node.entryId
              )
            : []
      const children = entries.map(entry => buildEntryNode(node, entry))

      if (node.kind === 'root') {
        set(treeStateAtom, {
          type: 'mergeRootHasChildren',
          rootHasChildrenById: {[nodeId]: children.length > 0}
        })
      }

      set(treeStateAtom, {type: 'setNodeChildren', nodeId, children})
    } finally {
      set(treeStateAtom, {type: 'setNodeLoading', nodeId, isLoading: false})
    }
  }
)

const loadWorkspaceRootHasChildrenCommand = command<[], Promise<void>>(
  async (get, set) => {
    const config = get(configAtom)
    const graph = get(graphAtom)
    const workspace = get(currentWorkspaceAtom)
    const workspaceConfig = config.workspaces[workspace]
    if (!workspaceConfig) return

    const typeNames = visibleTypes(config)
    const rootHasChildrenById: Record<string, boolean> = {}

    for (const [rootName] of Object.entries(Workspace.roots(workspaceConfig))) {
      const rootId = `root:${workspace}:${rootName}`
      const hasChildren =
        typeNames.length > 0
          ? await getHasChildren(graph, workspace, rootName, null, typeNames)
          : false
      rootHasChildrenById[rootId] = hasChildren
    }

    set(treeStateAtom, {type: 'mergeRootHasChildren', rootHasChildrenById})
  }
)

export const applyTreeRouteStateCommand = command<
  [CmsRoute?],
  Promise<void>
>(
  async (get, set, routeOverride) => {
    await set(loadWorkspaceRootHasChildrenCommand)

    const route = routeOverride ?? get(cmsRouteAtom)
    const workspace = route.workspace || get(currentWorkspaceAtom)
    const config = get(configAtom)
    const workspaceConfig = config.workspaces[workspace]
    if (!workspaceConfig) return

    const rootName =
      route.root || Object.keys(Workspace.roots(workspaceConfig))[0]
    if (!rootName || !workspaceConfig[rootName]) return

    const rootId = `root:${workspace}:${rootName}`
    const rootHasChildren = get(treeStateAtom).rootHasChildrenById[rootId] ?? false

    if (rootHasChildren) await set(loadTreeNodeChildrenCommand, rootId)

    const defaultExpandedRootIds = get(defaultExpandedRootIdsAtom).filter(rootNodeId =>
      Boolean(get(treeStateAtom).rootHasChildrenById[rootNodeId])
    )

    set(treeStateAtom, {
      type: 'addExpandedKeys',
      keys: new Set(defaultExpandedRootIds)
    })

    const graph = get(graphAtom)
    const entry = await queryEntryByRoute(graph, config, {
      ...route,
      workspace,
      root: rootName
    })

    if (!entry) {
      set(treeStateAtom, {type: 'setSelectedNodeId', nodeId: rootId})
      if (rootHasChildren) await set(focusTreeNodeCommand, rootId)
      else set(treeStateAtom, {type: 'setFocusedNodeId', nodeId: rootId})
      return
    }

    const ancestorIds = await queryAncestorIds(graph, entry.id)
    const expandedPathNodeIds = [rootId]

    for (const ancestorId of ancestorIds) {
      const nodeId = `entry:${ancestorId}`
      if (!get(treeNodeIndexAtom).has(nodeId)) continue
      expandedPathNodeIds.push(nodeId)
      await set(loadTreeNodeChildrenCommand, nodeId)
    }

    set(treeStateAtom, {
      type: 'addExpandedKeys',
      keys: new Set(expandedPathNodeIds)
    })

    const selectedNodeId = `entry:${entry.id}`
    set(treeStateAtom, {type: 'setSelectedNodeId', nodeId: selectedNodeId})

    if (entry.hasChildren) {
      await set(focusTreeNodeCommand, selectedNodeId)
      return
    }

    const focusNodeId = entry.parentId ? `entry:${entry.parentId}` : rootId
    await set(focusTreeNodeCommand, focusNodeId)
  }
)

export const treeBootstrapAtom = atom(
  false,
  async (_get, set) => {
    await set(applyTreeRouteStateCommand)
  }
)

export const treeExpandedKeysAtom = atom(
  get => get(treeStateAtom).expandedKeys,
  async (_get, set, keys: Set<string>) => {
    set(treeStateAtom, {type: 'setExpandedKeys', keys})
    for (const key of keys) {
      await set(loadTreeNodeChildrenCommand, key)
    }
  }
)

export const focusTreeNodeCommand = command<[string], Promise<void>>(
  async (get, set, nodeId) => {
    const node = get(treeNodeIndexAtom).get(nodeId)
    if (!node || !node.hasChildNodes) return
    await set(loadTreeNodeChildrenCommand, nodeId)
    set(treeStateAtom, {type: 'setFocusedNodeId', nodeId})
  }
)

export const moveTreeNodeCommand = command<
  [string, TreeDropTarget],
  Promise<CmsRoute | null>
>(async (get, set, nodeId, target) => {
  const config = get(configAtom)
  const itemIndex = get(treeItemIndexAtom)
  const item = itemIndex.get(nodeId)
  if (!item || item.node.kind !== 'entry' || !item.node.entryId) return null

  const resolvedTarget = resolveTreeDropTarget(itemIndex, target)
  if (!resolvedTarget) return null
  if (!canDropTreeItem(config, itemIndex, nodeId, target)) return null

  const parentNode = itemIndex.get(resolvedTarget.parentNodeId)?.node
  if (!parentNode) return null

  const graph = get(graphAtom)
  const siblingIds = await queryTreeChildIds(graph, config, parentNode)
  const nextSiblings = siblingIds.filter(childId => childId !== nodeId)

  let insertIndex = nextSiblings.length
  if (resolvedTarget.dropPosition !== 'on') {
    const targetIndex = nextSiblings.indexOf(resolvedTarget.targetNodeId)
    if (targetIndex === -1) return null
    insertIndex =
      resolvedTarget.dropPosition === 'before' ? targetIndex : targetIndex + 1
  }

  const afterNodeId = insertIndex > 0 ? nextSiblings[insertIndex - 1] : null
  const after = afterNodeId ? entryIdFromNodeId(afterNodeId) : null
  const newParent = item.node.parentId !== parentNode.id
  const toRoot = newParent && parentNode.kind === 'root' ? parentNode.root : undefined
  const toParent =
    newParent && parentNode.kind === 'entry' ? parentNode.entryId : undefined

  await graph.move({
    id: item.node.entryId,
    after,
    toParent,
    toRoot
  })

  set(treeStateAtom, {type: 'resetLoadedNodes'})

  const currentRoute = get(cmsRouteAtom)
  const nextRoute: CmsRoute = {
    ...currentRoute,
    workspace: parentNode.workspace,
    root: parentNode.root,
    entry: item.node.entryId
  }

  await set(applyTreeRouteStateCommand, nextRoute)
  return nextRoute
})

export const focusTreeParentCommand = command<[], void>((get, set) => {
  const focusedNodeId = get(treeFocusedNodeIdAtom)
  if (!focusedNodeId) return

  const focusedNode = get(treeNodeIndexAtom).get(focusedNodeId)
  if (!focusedNode?.parentId) {
    set(treeStateAtom, {type: 'setFocusedNodeId', nodeId: null})
    return
  }

  set(treeStateAtom, {type: 'setFocusedNodeId', nodeId: focusedNode.parentId})
})

export const treeItemsAtom = atom(get => {
  const state = get(treeStateAtom)
  const index = get(treeNodeIndexAtom)

  const toItem = (node: TreeNode): TreeItem => {
    const childIds = state.childIdsByParent[node.id]
    const item: TreeItem = {
      id: node.id,
      textValue: node.title,
      hasChildNodes: node.hasChildNodes,
      node
    }

    if (childIds && childIds.length > 0) {
      item.children = childIds
        .map(childId => index.get(childId))
        .filter((child): child is TreeNode => Boolean(child))
        .map(child => toItem(child))
    }

    return item
  }

  return get(workspaceRootNodesAtom).map(root => toItem(root))
})

export const treeItemIndexAtom = atom(get => {
  const index = new Map<string, TreeItem>()

  const addToIndex = (item: TreeItem) => {
    index.set(item.id, item)
    if (!item.children) return
    for (const child of item.children) addToIndex(child)
  }

  for (const root of get(treeItemsAtom)) addToIndex(root)
  return index
})

export const treeViewAtom = atom<TreeView>(get => {
  const items = get(treeItemsAtom)
  const focusedNodeId = get(treeFocusedNodeIdAtom)
  if (!focusedNodeId) return {focusItem: null, items}

  const focusItem = get(treeItemIndexAtom).get(focusedNodeId)
  if (!focusItem) return {focusItem: null, items}

  return {
    focusItem,
    items: focusItem.children ?? []
  }
})

export const treeAtom = atom<TreeSnapshot>(get => {
  const view = get(treeViewAtom)
  return {
    expandedKeys: get(treeExpandedKeysAtom),
    selectedKeys: get(treeSelectedKeysAtom),
    itemIndex: get(treeItemIndexAtom),
    focusItem: view.focusItem,
    items: view.items
  }
})
