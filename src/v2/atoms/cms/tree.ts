import type {Config} from 'alinea/core/Config'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {Entry} from 'alinea/core/Entry'
import {getType} from 'alinea/core/Internal'
import type {OrderBy} from 'alinea/core/OrderBy'
import {Root} from 'alinea/core/Root'
import {Type} from 'alinea/core/Type'
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

const reduceTreeState = (state: TreeState, action: TreeAction): TreeState => {
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

const buildRootNode = (
  workspace: string,
  rootName: string,
  rootLabel: string,
  hasChildNodes = true
): TreeNode => {
  return {
    id: `root:${workspace}:${rootName}`,
    parentId: null,
    kind: 'root',
    workspace,
    root: rootName,
    title: rootLabel,
    hasChildNodes,
    childIds: null
  }
}

const buildEntryNode = (
  parent: TreeNode,
  entry: TreeEntryPreview
): TreeNode => {
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

const toReactAriaTreeItem = (
  state: TreeState,
  nodeId: string
): ReactAriaTreeItem | undefined => {
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

const queryRootEntries = async (
  graph: WriteableGraph,
  config: Config,
  workspace: string,
  root: string
): Promise<Array<TreeEntryPreview>> => {
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
): Promise<Array<TreeEntryPreview>> => {
  const parent = await graph.first({
    id: parentEntryId,
    select: {type: Entry.type},
    status: 'preferDraft'
  })
  const parentType = parent ? config.schema[parent.type] : undefined
  const orderBy = parentType ? getType(parentType).orderChildrenBy : undefined
  return queryChildren(graph, config, workspace, root, parentEntryId, orderBy)
}

const visibleTypes = (config: Config): Array<string> => {
  return Object.entries(config.schema)
    .filter(([, type]) => {
      return !Type.isHidden(type)
    })
    .map(([name]) => {
      return name
    })
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

  const entries = Array.from(uniqueById.values())
  return Promise.all(
    entries.map(async row => {
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

const treeStateAtom = atom<TreeState>(initialTreeState)

export const treeDispatchCommand = command<[TreeAction]>((get, set, action) => {
  const state = get(treeStateAtom)
  set(treeStateAtom, reduceTreeState(state, action))
})

export const initializeTreeRootsCommand = command<[], Promise<void>>(
  async (get, set) => {
    const config = get(configAtom)
    const workspace = get(currentWorkspaceAtom)
    set(treeExpandedKeysAtom, new Set())
    set(treeSelectedKeysAtom, new Set())
    const workspaceConfig = config.workspaces[workspace]
    if (!workspaceConfig) {
      set(treeDispatchCommand, {type: 'hydrateRoots', roots: []})
      return
    }
    const roots = Object.entries(Workspace.roots(workspaceConfig)).map(
      ([rootName, root]) => {
        const label = Root.label(root)
        return buildRootNode(workspace, rootName, String(label), true)
      }
    )
    set(treeDispatchCommand, {type: 'hydrateRoots', roots})
  }
)

export const loadTreeNodeChildrenCommand = command<[string], Promise<void>>(
  async (get, set, nodeId) => {
    const state = get(treeStateAtom)
    const node = state.nodesById[nodeId]
    if (!node || !node.hasChildNodes || node.childIds !== null) return

    set(treeDispatchCommand, {type: 'setLoading', nodeId, isLoading: true})
    const graph = get(graphAtom)
    const config = get(configAtom)

    const rows =
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

    const children = rows.map(entry => {
      return buildEntryNode(node, entry)
    })
    set(treeDispatchCommand, {type: 'setChildren', nodeId, children})
  }
)

export const treeExpandedKeysAtom = atom(
  get => {
    return get(treeExpandedKeysStateAtom)
  },
  (_get, set, keys: Set<string>) => {
    set(treeExpandedKeysStateAtom, keys)
    for (const key of keys) {
      void set(loadTreeNodeChildrenCommand, key)
    }
  }
)

export const reactAriaTreeItemsAtom = atom(
  get => {
    const state = get(treeStateAtom)
    const items: Array<ReactAriaTreeItem> = []
    for (const rootId of state.rootIds) {
      const item = toReactAriaTreeItem(state, rootId)
      if (item) items.push(item)
    }
    return items
  },
  (_get, set) => {
    set(initializeTreeRootsCommand)
  }
)

reactAriaTreeItemsAtom.onMount = setAtom => {
  setAtom()
}
