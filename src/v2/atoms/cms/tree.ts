import type {Config} from 'alinea/core/Config'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {Entry} from 'alinea/core/Entry'
import {getType} from 'alinea/core/Internal'
import type {OrderBy} from 'alinea/core/OrderBy'
import {Root} from 'alinea/core/Root'
import {Type} from 'alinea/core/Type'
import {Workspace} from 'alinea/core/Workspace'
import {atom} from 'jotai'
import {currentWorkspaceAtom} from './workspaces.js'
import {configAtom} from '../config.js'
import {graphAtom} from '../graph.js'
import {command} from '../util/Command.js'

const treeExpandedKeysStateAtom = atom<Set<string>>(new Set<string>())
export const treeSelectedKeysAtom = atom<Set<string>>(new Set<string>())

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
}

export interface TreeEntryPreview {
  id: string
  title: string
  hasChildren: boolean
}

export interface ReactAriaTreeItem {
  id: string
  textValue: string
  hasChildNodes: boolean
  children?: Array<ReactAriaTreeItem>
  node: TreeNode
}

const buildRootNode = (
  workspace: string,
  rootName: string,
  rootLabel: string
): TreeNode => {
  return {
    id: `root:${workspace}:${rootName}`,
    parentId: null,
    kind: 'root',
    workspace,
    root: rootName,
    title: rootLabel,
    hasChildNodes: true
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
    hasChildNodes: entry.hasChildren
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
      type: Entry.type
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
        hasChildren
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

const workspaceRootNodesAtom = atom(get => {
  const config = get(configAtom)
  const workspace = get(currentWorkspaceAtom)
  const workspaceConfig = config.workspaces[workspace]
  if (!workspaceConfig) return []
  return Object.entries(Workspace.roots(workspaceConfig)).map(([rootName, root]) =>
    buildRootNode(workspace, rootName, String(Root.label(root)))
  )
})

const treeNodeIndexAtom = atom(get => {
  const index = new Map<string, TreeNode>()
  const roots = get(workspaceRootNodesAtom)
  for (const root of roots) index.set(root.id, root)
  const loaded = get(treeLoadedStateAtom)
  for (const [id, node] of Object.entries(loaded.nodesById)) index.set(id, node)
  return index
})

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

export const treeExpandedKeysAtom = atom(
  get => get(treeExpandedKeysStateAtom),
  (_get, set, keys: Set<string>) => {
    set(treeExpandedKeysStateAtom, keys)
    for (const key of keys) void set(loadTreeNodeChildrenCommand, key)
  }
)

export const reactAriaTreeItemsAtom = atom(get => {
  const loaded = get(treeLoadedStateAtom)
  const index = get(treeNodeIndexAtom)
  const toItem = (node: TreeNode): ReactAriaTreeItem => {
    const childIds = loaded.childIdsByParent[node.id]
    const item: ReactAriaTreeItem = {
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

export const treeStateSnapshotAtom = atom(get => {
  return {
    roots: get(workspaceRootNodesAtom),
    loaded: get(treeLoadedStateAtom),
    loading: get(treeLoadingStateAtom)
  }
})
