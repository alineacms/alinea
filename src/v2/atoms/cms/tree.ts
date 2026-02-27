import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {atom} from 'jotai'
import type {Key} from 'react'
import {currentWorkspaceAtom} from '../cms/workspaces.js'
import {configAtom} from '../config.js'
import {graphAtom} from '../graph.js'
import {command} from '../util/Command.js'
import {requiredAtom} from '../util/RequiredAtom.js'

export const treeExpandedKeysAtom = requiredAtom<Set<Key>>()
export const treeSelectedKeysAtom = requiredAtom<Set<Key>>()

export const treeRequiredAtoms = {
  expandedKeys: treeExpandedKeysAtom,
  selectedKeys: treeSelectedKeysAtom
}

export interface TreeNode {
  id: string
  parentId: string | null
  kind: 'root' | 'entry'
  workspace: string
  root: string
  title: string
  entryId?: string
  hasChildNodes: boolean
  childIds: Array<string> | null
  isLoading?: boolean
}

export interface TreeState {
  rootIds: Array<string>
  nodesById: Record<string, TreeNode>
}

export interface TreeAction {
  type: 'hydrateRoots' | 'setLoading' | 'setChildren' | 'invalidateNode'
  roots?: Array<TreeNode>
  nodeId?: string
  isLoading?: boolean
  children?: Array<TreeNode>
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

const initialTreeState: TreeState = {
  rootIds: [],
  nodesById: {}
}

function reduceTreeState(state: TreeState, action: TreeAction): TreeState {
  switch (action.type) {
    case 'hydrateRoots': {
      const roots = action.roots ?? []
      const nextNodesById = {...state.nodesById}
      const nextRootIds: Array<string> = []
      for (const root of roots) {
        nextRootIds.push(root.id)
        nextNodesById[root.id] = root
      }
      return {
        rootIds: nextRootIds,
        nodesById: nextNodesById
      }
    }
    case 'setLoading': {
      const nodeId = action.nodeId
      if (!nodeId) return state
      const current = state.nodesById[nodeId]
      if (!current) return state
      return {
        ...state,
        nodesById: {
          ...state.nodesById,
          [nodeId]: {
            ...current,
            isLoading: action.isLoading
          }
        }
      }
    }
    case 'setChildren': {
      const nodeId = action.nodeId
      if (!nodeId) return state
      const parent = state.nodesById[nodeId]
      if (!parent) return state
      const children = action.children ?? []
      const nextNodesById = {...state.nodesById}
      const childIds = children.map(child => child.id)
      for (const child of children) {
        nextNodesById[child.id] = child
      }
      nextNodesById[nodeId] = {
        ...parent,
        childIds,
        isLoading: false
      }
      return {
        ...state,
        nodesById: nextNodesById
      }
    }
    case 'invalidateNode': {
      const nodeId = action.nodeId
      if (!nodeId) return state
      const current = state.nodesById[nodeId]
      if (!current) return state
      return {
        ...state,
        nodesById: {
          ...state.nodesById,
          [nodeId]: {
            ...current,
            childIds: null,
            isLoading: false
          }
        }
      }
    }
    default:
      return state
  }
}

function buildRootNode(
  workspace: string,
  rootName: string,
  rootLabel: string
): TreeNode {
  return {
    id: `root:${workspace}:${rootName}`,
    parentId: null,
    kind: 'root',
    workspace,
    root: rootName,
    title: rootLabel,
    hasChildNodes: true,
    childIds: null
  }
}

function buildEntryNode(parent: TreeNode, entry: TreeEntryPreview): TreeNode {
  return {
    id: `entry:${entry.id}`,
    parentId: parent.id,
    kind: 'entry',
    workspace: parent.workspace,
    root: parent.root,
    title: entry.title,
    entryId: entry.id,
    hasChildNodes: entry.hasChildren,
    childIds: entry.hasChildren ? null : []
  }
}

function toReactAriaTreeItem(
  state: TreeState,
  nodeId: string
): ReactAriaTreeItem | undefined {
  const node = state.nodesById[nodeId]
  if (!node) return undefined
  const item: ReactAriaTreeItem = {
    id: node.id,
    textValue: node.title,
    hasChildNodes: node.hasChildNodes,
    node
  }
  if (node.childIds && node.childIds.length > 0) {
    const children: Array<ReactAriaTreeItem> = []
    for (const childId of node.childIds) {
      const child = toReactAriaTreeItem(state, childId)
      if (child) children.push(child)
    }
    item.children = children
  }
  return item
}

async function queryRootEntries(
  _graph: WriteableGraph,
  _workspace: string,
  _root: string
): Promise<Array<TreeEntryPreview>> {
  // TODO: Query first level root entries from the graph.
  return []
}

async function queryEntryChildren(
  _graph: WriteableGraph,
  _workspace: string,
  _root: string,
  _parentEntryId: string
): Promise<Array<TreeEntryPreview>> {
  // TODO: Query child entries for an entry node from the graph.
  return []
}

const treeStateAtom = atom<TreeState>(initialTreeState)

export const treeDispatchCommand = command<[TreeAction]>(
  function treeDispatchCommand(get, set, action) {
    const state = get(treeStateAtom)
    set(treeStateAtom, reduceTreeState(state, action))
  }
)

export const initializeTreeRootsCommand = command(
  function initializeTreeRootsCommand(get, set) {
    const config = get(configAtom)
    const workspace = get(currentWorkspaceAtom)
    const workspaceConfig = config.workspaces[workspace]
    if (!workspaceConfig) {
      set(treeDispatchCommand, {type: 'hydrateRoots', roots: []})
      return
    }
    const roots = Object.entries(Workspace.roots(workspaceConfig)).map(
      ([rootName, root]) => {
        const label = Root.label(root)
        return buildRootNode(workspace, rootName, String(label))
      }
    )
    set(treeDispatchCommand, {type: 'hydrateRoots', roots})
  }
)

export const loadTreeNodeChildrenCommand = command<[string], Promise<void>>(
  async function loadTreeNodeChildrenCommand(get, set, nodeId) {
    const state = get(treeStateAtom)
    const node = state.nodesById[nodeId]
    if (!node || !node.hasChildNodes || node.childIds !== null) return

    set(treeDispatchCommand, {type: 'setLoading', nodeId, isLoading: true})
    const graph = get(graphAtom)

    const rows =
      node.kind === 'root'
        ? await queryRootEntries(graph, node.workspace, node.root)
        : node.entryId
          ? await queryEntryChildren(
              graph,
              node.workspace,
              node.root,
              node.entryId
            )
          : []

    const children = rows.map(function mapEntry(entry) {
      return buildEntryNode(node, entry)
    })
    set(treeDispatchCommand, {type: 'setChildren', nodeId, children})
  }
)

export const reactAriaTreeItemsAtom = atom(
  function readReactAriaTreeItems(get) {
    const state = get(treeStateAtom)
    const items: Array<ReactAriaTreeItem> = []
    for (const rootId of state.rootIds) {
      const item = toReactAriaTreeItem(state, rootId)
      if (item) items.push(item)
    }
    return items
  }
)

export const treeStateSnapshotAtom = atom(function readTreeState(get) {
  return get(treeStateAtom)
})
