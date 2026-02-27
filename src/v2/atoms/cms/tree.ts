import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {atom} from 'jotai'
import {currentWorkspaceAtom} from '../cms/workspaces.js'
import {configAtom} from '../config.js'
import {graphAtom} from '../graph.js'
import {command} from '../util/Command.js'

const treeExpandedKeysStateAtom = atom<Set<string>>(new Set<string>())
export const treeSelectedKeysAtom = atom<Set<string>>(new Set<string>())

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

function buildFallbackRoots(workspace: string): Array<TreeNode> {
  return [
    buildRootNode(workspace, 'content', 'Content'),
    buildRootNode(workspace, 'marketing', 'Marketing'),
    buildRootNode(workspace, 'docs', 'Docs'),
    buildRootNode(workspace, 'shop', 'Shop')
  ]
}

function appendSampleRoots(
  workspace: string,
  roots: Array<TreeNode>
): Array<TreeNode> {
  const names = new Set(roots.map(root => root.root))
  const samples = [
    ['blog', 'Blog'],
    ['docs', 'Docs'],
    ['media', 'Media']
  ] as const
  const next = [...roots]
  for (const [name, label] of samples) {
    if (names.has(name)) continue
    next.push(buildRootNode(workspace, name, label))
    names.add(name)
    if (next.length >= 4) break
  }
  return next
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
  workspace: string,
  root: string
): Promise<Array<TreeEntryPreview>> {
  // TODO: replace dummy data with graph query.
  return [
    {
      id: `${workspace}:${root}:home`,
      title: 'Home',
      hasChildren: true
    },
    {
      id: `${workspace}:${root}:about`,
      title: 'About',
      hasChildren: false
    },
    {
      id: `${workspace}:${root}:blog`,
      title: 'Blog',
      hasChildren: true
    }
  ]
}

async function queryEntryChildren(
  _graph: WriteableGraph,
  workspace: string,
  root: string,
  parentEntryId: string
): Promise<Array<TreeEntryPreview>> {
  // TODO: replace dummy data with graph query.
  if (parentEntryId.endsWith(':home')) {
    return [
      {
        id: `${workspace}:${root}:home:hero`,
        title: 'Hero',
        hasChildren: false
      },
      {
        id: `${workspace}:${root}:home:features`,
        title: 'Features',
        hasChildren: true
      }
    ]
  }
  if (parentEntryId.endsWith(':home:features')) {
    return [
      {
        id: `${workspace}:${root}:home:features:feature-a`,
        title: 'Feature A',
        hasChildren: false
      },
      {
        id: `${workspace}:${root}:home:features:feature-b`,
        title: 'Feature B',
        hasChildren: false
      }
    ]
  }
  if (parentEntryId.endsWith(':blog')) {
    return [
      {
        id: `${workspace}:${root}:blog:welcome-post`,
        title: 'Welcome post',
        hasChildren: false
      },
      {
        id: `${workspace}:${root}:blog:release-notes`,
        title: 'Release notes',
        hasChildren: false
      }
    ]
  }
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
    set(treeExpandedKeysAtom, new Set())
    set(treeSelectedKeysAtom, new Set())
    const workspaceConfig = config.workspaces[workspace]
    if (!workspaceConfig) {
      set(treeDispatchCommand, {
        type: 'hydrateRoots',
        roots: buildFallbackRoots(workspace || 'workspace')
      })
      return
    }
    const roots = Object.entries(Workspace.roots(workspaceConfig)).map(
      ([rootName, root]) => {
        const label = Root.label(root)
        return buildRootNode(workspace, rootName, String(label))
      }
    )
    const rootsWithSamples = appendSampleRoots(workspace, roots)
    set(treeDispatchCommand, {
      type: 'hydrateRoots',
      roots: roots.length > 0 ? rootsWithSamples : buildFallbackRoots(workspace)
    })
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

export const treeExpandedKeysAtom = atom(
  function readTreeExpandedKeys(get) {
    return get(treeExpandedKeysStateAtom)
  },
  function writeTreeExpandedKeys(_get, set, keys: Set<string>) {
    set(treeExpandedKeysStateAtom, keys)
    for (const key of keys) {
      void set(loadTreeNodeChildrenCommand, key)
    }
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

export const treeBootstrapAtom = atom(
  null,
  function runTreeBootstrap(_get, set) {
    set(initializeTreeRootsCommand)
  }
)

treeBootstrapAtom.onMount = function onMountTreeBootstrap(setAtom) {
  setAtom()
}
