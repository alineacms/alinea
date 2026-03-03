import type {Config} from 'alinea/core/Config'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {Entry, type EntryStatus} from 'alinea/core/Entry'
import {getType} from 'alinea/core/Internal'
import type {OrderBy} from 'alinea/core/OrderBy'
import {Root} from 'alinea/core/Root'
import {Type} from 'alinea/core/Type'
import {Workspace} from 'alinea/core/Workspace'
import {atom} from 'jotai'
import {cmsRouteAtom, type CmsRoute} from './route.js'
import {currentWorkspaceAtom} from './workspaces.js'
import {configAtom} from '../config.js'
import {graphAtom} from '../graph.js'
import {command} from '../util/Command.js'

const treeExpandedKeysStateAtom = atom<Set<string>>(new Set<string>())
const treeBootstrappedStateAtom = atom<boolean>(false)
const treeRootHasChildrenStateAtom = atom<Record<string, boolean>>({})
export const treeSelectedKeysAtom = atom<Set<string>>(new Set<string>())
const treeFocusedNodeIdStateAtom = atom<string | null>(null)

interface TreeLoadedState {
  childIdsByParent: Record<string, Array<string>>
  nodesById: Record<string, TreeNode>
}

const treeLoadedStateAtom = atom<TreeLoadedState>({
  childIdsByParent: {},
  nodesById: {}
})

const treeLoadingStateAtom = atom<Record<string, boolean>>({})

export interface TreeNode {
  id: string
  parentId: string | null
  kind: 'root' | 'entry'
  workspace: string
  root: string
  title: string
  entryId?: string
  hasChildNodes: boolean
  entryStatus?: EntryStatus
  isUnpublished?: boolean
}

export interface TreeEntryPreview {
  id: string
  title: string
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

interface EntryRouteInfo {
  id: string
  parentId: string | null
  hasChildren: boolean
}

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

const workspaceRootNodesAtom = atom(get => {
  const config = get(configAtom)
  const workspace = get(currentWorkspaceAtom)
  const rootHasChildren = get(treeRootHasChildrenStateAtom)
  const workspaceConfig = config.workspaces[workspace]
  if (!workspaceConfig) return []
  return Object.entries(Workspace.roots(workspaceConfig)).map(
    ([rootName, root]) => {
      const rootId = `root:${workspace}:${rootName}`
      return buildRootNode(
        workspace,
        rootName,
        String(Root.label(root)),
        rootHasChildren[rootId] ?? true
      )
    }
  )
})

const workspaceDefaultExpandedRootIdsAtom = atom(get => {
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
  const loaded = get(treeLoadedStateAtom)
  for (const [id, node] of Object.entries(loaded.nodesById)) index.set(id, node)
  return index
})

export const treeFocusedNodeIdAtom = atom(
  get => {
    const focusedNodeId = get(treeFocusedNodeIdStateAtom)
    if (!focusedNodeId) return null
    return get(treeNodeIndexAtom).has(focusedNodeId) ? focusedNodeId : null
  },
  (_get, set, nodeId: string | null) => {
    set(treeFocusedNodeIdStateAtom, nodeId)
  }
)

export const loadTreeNodeChildrenCommand = command<[string], Promise<void>>(
  async (get, set, nodeId) => {
    const node = get(treeNodeIndexAtom).get(nodeId)
    if (!node || !node.hasChildNodes) return
    const loaded = get(treeLoadedStateAtom)
    if (loaded.childIdsByParent[nodeId]) return
    set(treeLoadingStateAtom, prev => ({...prev, [nodeId]: true}))
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
      set(treeRootHasChildrenStateAtom, previous => ({
        ...previous,
        [nodeId]: children.length > 0
      }))
    }
    set(treeLoadedStateAtom, prev => {
      const nodesById = {...prev.nodesById}
      for (const child of children) nodesById[child.id] = child
      return {
        childIdsByParent: {
          ...prev.childIdsByParent,
          [nodeId]: children.map(child => child.id)
        },
        nodesById
      }
    })
    set(treeLoadingStateAtom, prev => ({...prev, [nodeId]: false}))
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
    const rootChildrenState: Record<string, boolean> = {}
    for (const [rootName] of Object.entries(Workspace.roots(workspaceConfig))) {
      const rootId = `root:${workspace}:${rootName}`
      const hasChildren =
        typeNames.length > 0
          ? await getHasChildren(graph, workspace, rootName, null, typeNames)
          : false
      rootChildrenState[rootId] = hasChildren
    }
    set(treeRootHasChildrenStateAtom, previous => ({
      ...previous,
      ...rootChildrenState
    }))
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
    const rootName = route.root || Object.keys(Workspace.roots(workspaceConfig))[0]
    if (!rootName || !workspaceConfig[rootName]) return

    const rootId = `root:${workspace}:${rootName}`
    const rootHasChildren = get(treeRootHasChildrenStateAtom)[rootId] ?? false
    if (rootHasChildren) await set(loadTreeNodeChildrenCommand, rootId)
    const defaultExpandedRootIds = get(workspaceDefaultExpandedRootIdsAtom).filter(
      rootNodeId => get(treeRootHasChildrenStateAtom)[rootNodeId]
    )
    set(treeExpandedKeysStateAtom, previousKeys => {
      const nextKeys = new Set(previousKeys)
      for (const rootNodeId of defaultExpandedRootIds) nextKeys.add(rootNodeId)
      return nextKeys
    })

    const graph = get(graphAtom)
    const entry = await queryEntryByRoute(graph, config, {
      ...route,
      workspace,
      root: rootName
    })

    if (!entry) {
      set(treeSelectedKeysAtom, new Set<string>([rootId]))
      if (rootHasChildren) await set(focusTreeNodeCommand, rootId)
      else set(treeFocusedNodeIdStateAtom, rootId)
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

    const nextExpandedKeys = new Set(get(treeExpandedKeysStateAtom))
    for (const nodeId of expandedPathNodeIds) nextExpandedKeys.add(nodeId)
    set(treeExpandedKeysStateAtom, nextExpandedKeys)

    const selectedNodeId = `entry:${entry.id}`
    set(treeSelectedKeysAtom, new Set<string>([selectedNodeId]))

    if (entry.hasChildren) {
      await set(focusTreeNodeCommand, selectedNodeId)
      return
    }

    const focusNodeId = entry.parentId ? `entry:${entry.parentId}` : rootId
    await set(focusTreeNodeCommand, focusNodeId)
  }
)

export const treeBootstrapAtom = atom(
  get => get(treeBootstrappedStateAtom),
  async (get, set) => {
    if (get(treeBootstrappedStateAtom)) return
    await set(applyTreeRouteStateCommand)
    set(treeBootstrappedStateAtom, true)
  }
)
treeBootstrapAtom.onMount = function onMount(set) {
  set()
}

export const treeExpandedKeysAtom = atom(
  get => get(treeExpandedKeysStateAtom),
  async (_get, set, keys: Set<string>) => {
    set(treeExpandedKeysStateAtom, keys)
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
    set(treeFocusedNodeIdStateAtom, nodeId)
  }
)

export const focusTreeParentCommand = command<[], void>((get, set) => {
  const focusedNodeId = get(treeFocusedNodeIdAtom)
  if (!focusedNodeId) return
  const focusedNode = get(treeNodeIndexAtom).get(focusedNodeId)
  if (!focusedNode?.parentId) {
    set(treeFocusedNodeIdStateAtom, null)
    return
  }
  set(treeFocusedNodeIdStateAtom, focusedNode.parentId)
})

export const treeItemsAtom = atom(get => {
  const loaded = get(treeLoadedStateAtom)
  const index = get(treeNodeIndexAtom)
  const toItem = (node: TreeNode): TreeItem => {
    const childIds = loaded.childIdsByParent[node.id]
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
