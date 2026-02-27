import {Entry} from 'alinea/core/Entry'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import type {Selection} from 'react-aria-components'
import {useEffect, useMemo, useReducer} from 'react'
import {useApp} from '../../hooks'
import type {RouteState} from '../../routing/state'

interface TreeEntryRow {
  id: string
  title: string
}

export interface DashboardTreeNode {
  id: string
  title: string
  kind: 'root' | 'entry'
  root: string
  entryId?: string
  hasChildItems: boolean
  children?: Array<DashboardTreeNode>
}

interface TreeState {
  childrenByParent: Record<string, Array<DashboardTreeNode>>
  expandedKeys: Set<string>
  loadingKeys: Set<string>
}

type Action =
  | {type: 'reset'; root: string}
  | {type: 'ensureRootExpanded'; root: string}
  | {type: 'setExpanded'; keys: Set<string>}
  | {type: 'setLoading'; key: string; loading: boolean}
  | {type: 'setChildren'; key: string; children: Array<DashboardTreeNode>}

interface TreeHookResult {
  items: Array<DashboardTreeNode>
  selectedKeys: Array<string>
  expandedKeys: Set<string>
  onSelectionChange(keys: Selection): void
  onExpandedChange(keys: Set<string>): void
  isLoadingTree: boolean
}

const rootKey = (root: string) => `root:${root}`
const entryKey = (root: string, id: string) => `entry:${root}:${id}`

function parseKey(
  key: string
): {kind: 'root'; root: string} | {kind: 'entry'; root: string; id: string} | null {
  if (key.startsWith('root:')) return {kind: 'root', root: key.slice(5)}
  if (!key.startsWith('entry:')) return null
  const rest = key.slice(6)
  const splitAt = rest.indexOf(':')
  if (splitAt < 0) return null
  return {
    kind: 'entry',
    root: rest.slice(0, splitAt),
    id: rest.slice(splitAt + 1)
  }
}

function sameKeySet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const key of a) if (!b.has(key)) return false
  return true
}

function reducer(state: TreeState, action: Action): TreeState {
  switch (action.type) {
    case 'reset':
      return {
        childrenByParent: {},
        expandedKeys: new Set([rootKey(action.root)]),
        loadingKeys: new Set()
      }
    case 'ensureRootExpanded': {
      const key = rootKey(action.root)
      if (state.expandedKeys.has(key)) return state
      return {
        ...state,
        expandedKeys: new Set([...state.expandedKeys, key])
      }
    }
    case 'setExpanded': {
      if (sameKeySet(state.expandedKeys, action.keys)) return state
      return {...state, expandedKeys: action.keys}
    }
    case 'setLoading': {
      const loadingKeys = new Set(state.loadingKeys)
      if (action.loading) loadingKeys.add(action.key)
      else loadingKeys.delete(action.key)
      if (sameKeySet(loadingKeys, state.loadingKeys)) return state
      return {...state, loadingKeys}
    }
    case 'setChildren': {
      return {
        ...state,
        childrenByParent: {
          ...state.childrenByParent,
          [action.key]: action.children
        }
      }
    }
  }
}

async function loadRows(
  db: ReturnType<typeof useApp>['db'],
  workspace: string,
  root: string,
  parentId: string | null
): Promise<Array<TreeEntryRow>> {
  const rows = await db.find({
    select: {
      id: Entry.id,
      title: Entry.title
    },
    workspace,
    root,
    parentId,
    status: 'preferDraft'
  })
  return rows as Array<TreeEntryRow>
}

async function detectChildren(
  db: ReturnType<typeof useApp>['db'],
  workspace: string,
  root: string,
  ids: Array<string>
): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await db.find({
    select: {
      parentId: Entry.parentId
    },
    workspace,
    root,
    filter: {
      _parentId: {
        in: ids
      }
    },
    status: 'preferDraft'
  })
  const found = new Set<string>()
  for (const row of rows as Array<{parentId: string | null}>) {
    if (row.parentId) found.add(row.parentId)
  }
  return found
}

export function useDashboardTree(
  route: RouteState,
  navigate: (next: RouteState, replace?: boolean) => void
): TreeHookResult {
  const {config, db} = useApp()
  const workspace = config.workspaces[route.workspace]
  const roots = Workspace.data(workspace).roots

  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    childrenByParent: {},
    expandedKeys: new Set([rootKey(route.root)]),
    loadingKeys: new Set<string>()
  }))

  useEffect(() => {
    dispatch({type: 'reset', root: route.root})
  }, [route.workspace])

  useEffect(() => {
    dispatch({type: 'ensureRootExpanded', root: route.root})
  }, [route.root])

  useEffect(() => {
    const keysToLoad = [...state.expandedKeys].filter(key => {
      const parsed = parseKey(key)
      if (!parsed) return false
      if (state.childrenByParent[key]) return false
      if (state.loadingKeys.has(key)) return false
      return true
    })
    if (keysToLoad.length === 0) return

    let active = true
    keysToLoad.forEach(key => {
      dispatch({type: 'setLoading', key, loading: true})
      const parsed = parseKey(key)
      if (!parsed) {
        dispatch({type: 'setLoading', key, loading: false})
        return
      }
      const parentId = parsed.kind === 'entry' ? parsed.id : null
      loadRows(db, route.workspace, parsed.root, parentId)
        .then(rows =>
          detectChildren(
            db,
            route.workspace,
            parsed.root,
            rows.map(row => row.id)
          ).then(childPresence => {
            if (!active) return
            const children: Array<DashboardTreeNode> = rows.map(row => ({
              id: entryKey(parsed.root, row.id),
              title: row.title || row.id,
              kind: 'entry',
              root: parsed.root,
              entryId: row.id,
              hasChildItems: childPresence.has(row.id)
            }))
            dispatch({type: 'setChildren', key, children})
          })
        )
        .finally(() => {
          if (!active) return
          dispatch({type: 'setLoading', key, loading: false})
        })
    })

    return () => {
      active = false
    }
  }, [db, route.workspace, state.expandedKeys, state.loadingKeys, state.childrenByParent])

  const hydrate = (node: DashboardTreeNode): DashboardTreeNode => {
    const children = state.childrenByParent[node.id]
    if (!children) return node
    return {
      ...node,
      children: children.map(hydrate)
    }
  }

  const items = useMemo(() => {
    return Object.keys(roots).map(name => {
      const key = rootKey(name)
      const loaded = state.childrenByParent[key]
      const node: DashboardTreeNode = {
        id: key,
        title: Root.data(roots[name]).label,
        kind: 'root',
        root: name,
        hasChildItems: loaded ? loaded.length > 0 : true
      }
      return hydrate(node)
    })
  }, [roots, state.childrenByParent])

  const selectedKeys = route.entryId
    ? [entryKey(route.root, route.entryId)]
    : [rootKey(route.root)]

  const onSelectionChange = (keys: Selection) => {
    if (keys === 'all') return
    const [raw] = Array.from(keys)
    if (typeof raw !== 'string') return
    const parsed = parseKey(raw)
    if (!parsed) return
    if (parsed.kind === 'root') {
      if (parsed.root === route.root && !route.entryId) return
      navigate({workspace: route.workspace, root: parsed.root})
      return
    }
    if (parsed.root === route.root && parsed.id === route.entryId) return
    navigate({workspace: route.workspace, root: parsed.root, entryId: parsed.id})
  }

  const onExpandedChange = (keys: Set<string>) => {
    dispatch({type: 'setExpanded', keys: new Set(keys)})
  }

  return {
    items,
    selectedKeys,
    expandedKeys: state.expandedKeys,
    onSelectionChange,
    onExpandedChange,
    isLoadingTree: state.loadingKeys.size > 0
  }
}
