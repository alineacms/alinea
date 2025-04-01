import type {
  AsyncTreeDataLoader,
  DropTarget,
  ItemInstance
} from '@headless-tree/core'
import {Entry} from 'alinea/core/Entry'
import type {EntryStatus} from 'alinea/core/Entry'
import type {Graph} from 'alinea/core/Graph'
import {getRoot, getType} from 'alinea/core/Internal'
import {Type} from 'alinea/core/Type'
import {entries} from 'alinea/core/util/Objects'
import {parents} from 'alinea/query'
import DataLoader from 'dataloader'
import {atom, useAtomValue} from 'jotai'
import {useMemo} from 'react'
import {configAtom} from './DashboardAtoms.js'
import {dbAtom} from './DbAtoms.js'
import {localeAtom, rootAtom, workspaceAtom} from './NavigationAtoms.js'

export function rootId(rootName: string) {
  return `@alinea/root-${rootName}`
}

const visibleTypesAtom = atom(get => {
  const {schema} = get(configAtom)
  return entries(schema)
    .filter(([_, type]) => !Type.isHidden(type))
    .map(([name]) => name)
})

async function entryTreeRoot(
  graph: Graph,
  status: 'preferDraft' | 'preferPublished',
  workspace: string,
  rootName: string,
  visibleTypes: Array<string>
): Promise<EntryTreeItem> {
  const root = graph.config.workspaces[workspace][rootName]
  const orderBy = getRoot(root).orderChildrenBy
  const children = await graph.find({
    select: Entry.id,
    groupBy: Entry.id,
    orderBy,
    filter: {
      _active: true,
      _workspace: workspace,
      _root: rootName,
      _parentId: null,
      _type: {in: visibleTypes}
    },
    status
  })
  return {
    id: rootId(rootName),
    index: '',
    type: '',
    isFolder: true,
    isRoot: true,
    entries: [],
    children
  }
}

const entryTreeItemLoaderAtom = atom(async get => {
  const graph = await get(dbAtom)
  const locale = get(localeAtom)
  const visibleTypes = get(visibleTypesAtom)
  const {schema} = get(configAtom)
  const root = get(rootAtom)
  const workspace = get(workspaceAtom)
  return new DataLoader(async (ids: ReadonlyArray<string>) => {
    const indexed = new Map<string, EntryTreeItem>()
    const search = (ids as Array<string>).filter(id => id !== rootId(root.name))
    const data = {
      id: Entry.id,
      type: Entry.type,
      title: Entry.title,
      status: Entry.status,
      locale: Entry.locale,
      workspace: Entry.workspace,
      root: Entry.root,
      path: Entry.path,
      parents: parents({
        select: {
          path: Entry.path,
          type: Entry.type
        }
      })
    }
    const rows = await graph.find({
      groupBy: Entry.id,
      select: {
        id: Entry.id,
        index: Entry.index,
        type: Entry.type,
        data,
        translations: {
          edge: 'translations',
          select: data
        }
      },
      id: {in: search},
      status: 'preferDraft'
    })
    for (const row of rows) {
      const canDrag =
        row.data.parents.length > 0
          ? !getType(schema[row.data.parents.at(-1)!.type]).orderChildrenBy
          : true
      const type = schema[row.type]
      const orderBy = getType(type).orderChildrenBy
      const children = await graph.find({
        select: {
          id: Entry.id,
          locale: Entry.locale
        },
        groupBy: Entry.id,
        orderBy,
        filter: {
          _parentId: row.id,
          _type: {in: visibleTypes}
        },
        status: 'preferDraft'
      })
      const entries = [row.data].concat(row.translations)
      const translatedChildren = new Set(
        children.filter(child => child.locale === locale).map(child => child.id)
      )
      const untranslated = new Set()
      const orderedChildren = children.filter(child => {
        if (translatedChildren.has(child.id)) return child.locale === locale
        if (untranslated.has(child.id)) return false
        untranslated.add(child.id)
        return true
      })
      indexed.set(row.id, {
        id: row.id,
        type: row.type,
        index: row.index,
        entries,
        canDrag,
        children: [...new Set(orderedChildren.map(child => child.id))]
      })
    }
    const res: Array<EntryTreeItem | undefined> = []
    for (const id of ids) {
      if (id === rootId(root.name)) {
        res.push(
          await entryTreeRoot(
            graph,
            'preferDraft',
            workspace.name,
            root.name,
            visibleTypes
          )
        )
        continue
      }
      const entry = indexed.get(id)!
      if (!entry) {
        res.push(undefined)
        continue
      }
      const typeName = entry.entries[0].type
      const type = schema[typeName]
      const isFolder = Type.isContainer(type)
      res.push({...entry, isFolder})
    }
    return res
  })
})

const loaderAtom = atom(get => {
  // Don't return the Promise directly because that causes Jotai to suspend
  return {loader: get(entryTreeItemLoaderAtom)}
})

export interface EntryTreeItem {
  id: string
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
    parents: Array<{path: string; type: string}>
  }>
  isFolder?: boolean
  isRoot?: boolean
  canDrag?: boolean
  children: Array<string>
}

export function useEntryTreeProvider(): AsyncTreeDataLoader<EntryTreeItem> & {
  canDrag(item: Array<ItemInstance<EntryTreeItem>>): boolean
  onDrop(
    items: Array<ItemInstance<EntryTreeItem>>,
    target: DropTarget<EntryTreeItem>
  ): void
} {
  const {loader} = useAtomValue(loaderAtom)
  const db = useAtomValue(dbAtom)
  return useMemo(() => {
    return {
      canDrag(items) {
        return items.every(item => {
          const data = item.getItemData()
          return data.canDrag
        })
      },
      onDrop(items, {item: parent, childIndex, insertionIndex}) {
        if (items.length !== 1) return
        const [dropping] = items
        const children = parent.getChildren()
        const previous = childIndex ? children[childIndex - 1] : null
        const after = previous ? previous.getId() : null
        const newParent = dropping.getParent() !== parent
        const toRoot = parent.getId().startsWith('@alinea')
          ? dropping.getItemData().entries[0].root
          : undefined
        const toParent = !toRoot && newParent ? parent.getId() : undefined
        console.log({
          id: dropping.getId(),
          after,
          toParent,
          toRoot
        })
        db.move({
          id: dropping.getId(),
          after,
          toParent,
          toRoot
        })
      },
      async getItem(id): Promise<EntryTreeItem> {
        return (await (await loader).clear(id).load(id))!
      },
      async getChildren(id): Promise<Array<string>> {
        return this.getItem(id).then(item => item?.children ?? [])
      }
    }
  }, [loader])
}
