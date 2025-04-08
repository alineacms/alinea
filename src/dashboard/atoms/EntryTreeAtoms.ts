import type {
  DragTarget,
  ItemInstance,
  TreeDataLoader
} from '@headless-tree/core'
import {Entry} from 'alinea/core/Entry'
import type {EntryStatus} from 'alinea/core/Entry'
import {getType} from 'alinea/core/Internal'
import {} from 'alinea/core/Trigger'
import {Type} from 'alinea/core/Type'
import {entries} from 'alinea/core/util/Objects'
import {parent, translations} from 'alinea/query'
import DataLoader from 'dataloader'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {atomFamily, unwrap} from 'jotai/utils'
import {useEffect, useMemo} from 'react'
import {configAtom} from './DashboardAtoms.js'
import {dbAtom, entryRevisionAtoms} from './DbAtoms.js'
import {rootAtom, workspaceAtom} from './NavigationAtoms.js'

export const ROOT_ID = '@alinea/root'

export interface EntryTreeItem {
  id: string
  parentId: string | null
  index: string
  type: string
  entries: Array<{
    id: string
    type: string
    title: string
    status: EntryStatus
    locale: string | null
    workspace: string
    root: string
    path: string
  }>
  isFolder?: boolean
  isRoot?: boolean
  canDrag?: boolean
  // children: Array<string>
}

const childrenLoaderAtom = atom(get => {
  const graph = get(dbAtom)
  const workspace = get(workspaceAtom)
  const root = get(rootAtom)
  return new DataLoader<string, Array<EntryTreeItem>>(
    async (parentIds: ReadonlyArray<string>) => {
      const data = {
        id: Entry.id,
        type: Entry.type,
        title: Entry.title,
        status: Entry.status,
        locale: Entry.locale,
        workspace: Entry.workspace,
        root: Entry.root,
        path: Entry.path,
        parentId: Entry.parentId
      }
      const select = {
        id: Entry.id,
        index: Entry.index,
        type: Entry.type,
        parentId: Entry.parentId,
        data,
        translations: translations({select: data}),
        parentType: parent({select: Entry.type})
      }
      const rows = await graph.find({
        groupBy: Entry.id,
        workspace: workspace.name,
        root: root.name,
        select,
        parentId: {in: parentIds.map(id => (id === ROOT_ID ? null : id))},
        status: 'preferDraft'
      })
      return parentIds.map(parentId => {
        const children = rows.filter(
          row => row.parentId === (parentId === ROOT_ID ? null : parentId)
        )
        return children.map(child => {
          const canDrag = child.parentType
            ? !getType(graph.config.schema[child.parentType]).orderChildrenBy
            : true
          const entries = [child.data].concat(child.translations)
          const typeName = child.data.type
          const type = graph.config.schema[typeName]
          const isFolder = Type.isContainer(type)
          const result = {...child, canDrag, entries, isFolder}
          return result
        })
      })
    }
  )
})

const childrenOf = atomFamily((parentId: string) => {
  return atom(async get => {
    const loader = get(childrenLoaderAtom)
    // We clear the dataloader cache because we use the atom family cache
    const children = await loader.clear(parentId).load(parentId)
    if (parentId !== null) get(entryRevisionAtoms(parentId))
    for (const child of children) get(entryRevisionAtoms(child.id))
    return children
  })
})

const visibleTypesAtom = atom(get => {
  const {schema} = get(configAtom)
  return entries(schema)
    .filter(([_, type]) => !Type.isHidden(type))
    .map(([name]) => name)
})

export interface EntryTreeProvider extends TreeDataLoader<EntryTreeItem> {
  invalidate(id: string): Array<string>
  canDrag(item: Array<ItemInstance<EntryTreeItem>>): boolean
  onDrop(
    items: Array<ItemInstance<EntryTreeItem>>,
    target: DragTarget<EntryTreeItem>
  ): void
}

const expandedAtom = atom(Array<string>())

const treeAtom = unwrap(
  atom(async get => {
    const expanded = get(expandedAtom)
    console.log(expanded)
    const parentIds = Array<string>(ROOT_ID, ...expanded)
    const byParent = new Map(
      await Promise.all(
        parentIds.map(async parentId => {
          return [parentId, await get(childrenOf(parentId))] as const
        })
      )
    )
    const byId = new Map(
      [...byParent.values()].flatMap(children =>
        children.map(child => [child.id, child] as const)
      )
    )
    return {expanded, byId, byParent}
  }),
  prev => prev
)

export function useEntryTreeProvider(
  selectedId: string | undefined,
  expanded: Array<string>
): EntryTreeProvider {
  const db = useAtomValue(dbAtom)
  const tree = useAtomValue(treeAtom)
  const setExpanded = useSetAtom(expandedAtom)

  useEffect(() => {
    setExpanded(expanded)
  }, [expanded.join()])

  return useMemo(() => {
    return {
      expanded: tree?.expanded ?? [],
      invalidate() {
        return Array<string>()
      },
      getItem(id: string) {
        if (!tree?.byId.has(id)) throw new Error('Item not found: ' + id)
        return tree?.byId.get(id)
      },
      getChildren(parentId: string) {
        return tree?.byParent.get(parentId)?.map(child => child.id) ?? []
      },
      canDrag(items) {
        return items.every(item => {
          const data = item.getItemData()
          return data.canDrag
        })
      },
      onDrop(items, target) {
        const {item: parent} = target
        if (items.length !== 1) return
        const [dropping] = items
        const children = parent.getChildren()
        const previous =
          'childIndex' in target ? children[target.childIndex - 1] : null
        const after = previous ? previous.getId() : null
        const newParent = dropping.getParent() !== parent
        const toRoot =
          parent.getId() === ROOT_ID
            ? dropping.getItemData().entries[0].root
            : undefined
        const toParent = !toRoot && newParent ? parent.getId() : undefined
        db.move({
          id: dropping.getId(),
          after,
          toParent,
          toRoot
        })
      }
    }
  }, [db, tree])
}
/*
function useTreeEntries() {
  const graph = useGraph()
  const workspace = useWorkspace()
  const root = useRoot()
  const visibleTypes = useAtomValue(visibleTypesAtom)
  const {loading, finished, isFetching} = useMemo(() => {
    const loading = new Map<string, Trigger<EntryTreeItem>>()
    const finished = new Map<string, EntryTreeItem>()
    const isFetching = new WeakSet<Promise<EntryTreeItem>>()
    return {loading, finished, isFetching}
  }, [])
  return useMemo(() => {
    const loadBatch = debounce(() => {
      const toLoad = Array.from(loading).filter(([id, trigger]) => {
        return !isFetching.has(trigger)
      })
      if (toLoad.length === 0) return
      let loadRoot: Trigger<EntryTreeItem> | undefined
      for (const [id, trigger] of toLoad) {
        if (id === ROOT_ID) loadRoot = trigger
        isFetching.add(trigger)
      }
      const data = {
        id: Entry.id,
        type: Entry.type,
        title: Entry.title,
        status: Entry.status,
        locale: Entry.locale,
        workspace: Entry.workspace,
        root: Entry.root,
        path: Entry.path,
        parentId: Entry.parentId
      }
      const select = {
        id: Entry.id,
        index: Entry.index,
        type: Entry.type,
        parentId: Entry.parentId,
        data,
        translations: translations({select: data}),
        children: children({select: Entry.id})
      }
      if (loadRoot) {
        graph
          .find({
            groupBy: Entry.id,
            workspace: workspace.name,
            root: root.name,
            parentId: null,
            select: Entry.id,
            status: 'preferDraft'
          })
          .then(children => {
            console.log(children)
            const result = {
              id: ROOT_ID,
              parentId: null,
              index: '',
              type: '',
              isFolder: true,
              isRoot: true,
              entries: [],
              children
            }
            loadRoot.resolve(result)
            finished.set(ROOT_ID, result)
          })
      }
      const ids = toLoad.filter(([id]) => id !== ROOT_ID).map(([id]) => id)
      const rows = graph.find({
        groupBy: Entry.id,
        workspace: workspace.name,
        root: root.name,
        select,
        filter: {_id: {in: ids}},
        status: 'preferDraft'
      })
      rows.then(rows => {
        for (const row of rows) {
          const parent = row.parentId ? finished.get(row.parentId) : null
          const canDrag = parent
            ? !getType(graph.config.schema[parent.type]).orderChildrenBy
            : true
          const entries = [row.data].concat(row.translations)
          const typeName = row.data.type
          const type = graph.config.schema[typeName]
          const isFolder = Type.isContainer(type) && row.children.length > 0
          const result = {...row, canDrag, entries, isFolder}
          const trigger = loading.get(row.id)!
          finished.set(row.id, result)
          trigger.resolve(result)
        }
      })
    }, 0)

    function getItem(id: string) {
      if (finished.has(id)) return finished.get(id)!
      if (loading.has(id)) return loading.get(id)!
      const result = trigger<EntryTreeItem>()
      loading.set(id, result)
      loadBatch()
      return result
    }

    function getChildren(id: string) {
      const item = getItem(id)
      if (item instanceof Promise) return item.then(item => item.children)
      return item.children
    }

    function invalidate(id: string) {
      const result = new Set([id])
      loading.delete(ROOT_ID)
      result.add(ROOT_ID)
      loading.delete(id)
      for (const item of finished.values()) {
        if (item.children.includes(id)) {
          loading.delete(item.id)
          result.add(item.id)
        }
      }
      console.log(result)
      return [...result]
    }

    return {getItem, getChildren, invalidate}
  }, [workspace, root])
}

export interface EntryTreeItem {
  id: string
  parentId: string | null
  index: string
  type: string
  entries: Array<{
    id: string
    type: string
    title: string
    status: EntryStatus
    locale: string | null
    workspace: string
    root: string
    path: string
  }>
  isFolder?: boolean
  isRoot?: boolean
  canDrag?: boolean
  // children: Array<string>
}

export interface EntryTreeProvider extends TreeDataLoader<EntryTreeItem> {
  invalidate(id: string): Array<string>
  canDrag(item: Array<ItemInstance<EntryTreeItem>>): boolean
  onDrop(
    items: Array<ItemInstance<EntryTreeItem>>,
    target: DragTarget<EntryTreeItem>
  ): void
}

export function useEntryTreeProvider(
  expanded: ReadonlyArray<string>
): EntryTreeProvider {
  const entries = useTreeEntries()
  const db = useAtomValue(dbAtom)
  return useMemo(() => {
    return {
      ...entries,
      canDrag(items) {
        return items.every(item => {
          const data = item.getItemData()
          return data.canDrag
        })
      },
      onDrop(items, target) {
        const {item: parent} = target
        if (items.length !== 1) return
        const [dropping] = items
        const children = parent.getChildren()
        const previous =
          'childIndex' in target ? children[target.childIndex - 1] : null
        const after = previous ? previous.getId() : null
        const newParent = dropping.getParent() !== parent
        const toRoot =
          parent.getId() === ROOT_ID
            ? dropping.getItemData().entries[0].root
            : undefined
        const toParent = !toRoot && newParent ? parent.getId() : undefined
        db.move({
          id: dropping.getId(),
          after,
          toParent,
          toRoot
        })
      }
    }
  }, [db, entries])
}
*/
