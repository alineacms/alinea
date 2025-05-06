import type {
  DragTarget,
  ItemInstance,
  TreeDataLoader
} from '@headless-tree/core'
import {Config} from 'alinea/core/Config'
import {Entry} from 'alinea/core/Entry'
import type {EntryStatus} from 'alinea/core/Entry'
import type {Graph} from 'alinea/core/Graph'
import {getRoot, getType} from 'alinea/core/Internal'
import type {OrderBy} from 'alinea/core/OrderBy.js'
import {Type} from 'alinea/core/Type'
import {entries} from 'alinea/core/util/Objects'
import {parents, translations} from 'alinea/query'
import DataLoader from 'dataloader'
import {atom, useAtomValue} from 'jotai'
import PLazy from 'p-lazy'
import {useMemo} from 'react'
import {configAtom} from './DashboardAtoms.js'
import {dbAtom} from './DbAtoms.js'
import {localeAtom, rootAtom, workspaceAtom} from './NavigationAtoms.js'

export const ROOT_ID = '@alinea/root'

const visibleTypesAtom = atom(get => {
  const {schema} = get(configAtom)
  return entries(schema)
    .filter(([_, type]) => !Type.isHidden(type))
    .map(([name]) => name)
})

function childrenOf(
  graph: Graph,
  locale: string | null,
  workspace: string,
  root: string,
  parentId: string | null,
  visibleTypes: Array<string>,
  orderBy: OrderBy | Array<OrderBy> | undefined
) {
  return PLazy.from(async () => {
    const children = await graph.find({
      select: {
        id: Entry.id,
        locale: Entry.locale
      },
      orderBy,
      workspace,
      root: root,
      parentId,
      filter: {
        _type: {in: visibleTypes}
      },
      status: 'preferDraft'
    })
    const untranslated = new Set()
    const translatedChildren = new Set(
      children.filter(child => child.locale === locale).map(child => child.id)
    )
    const orderedChildren = children.filter(child => {
      if (translatedChildren.has(child.id)) return child.locale === locale
      if (untranslated.has(child.id)) return false
      untranslated.add(child.id)
      return true
    })
    return [...new Set(orderedChildren.map(child => child.id))]
  })
}

async function entryTreeRoot(
  graph: Graph,
  locale: string | null,
  workspace: string,
  rootName: string,
  visibleTypes: Array<string>
): Promise<EntryTreeItem> {
  const root = graph.config.workspaces[workspace][rootName]
  const orderBy = getRoot(root).orderChildrenBy
  return {
    id: ROOT_ID,
    index: '',
    type: ROOT_ID,
    isFolder: true,
    isRoot: true,
    entries: [],
    children: childrenOf(
      graph,
      locale,
      workspace,
      rootName,
      null,
      visibleTypes,
      orderBy
    )
  }
}

const loaderAtom = atom(get => {
  const graph = get(dbAtom)
  const locale = get(localeAtom)
  const visibleTypes = get(visibleTypesAtom)
  const {schema} = get(configAtom)
  const root = get(rootAtom)
  const workspace = get(workspaceAtom)
  return new DataLoader(async (ids: ReadonlyArray<string>) => {
    const indexed = new Map<string, EntryTreeItem>()
    const search = (ids as Array<string>).filter(id => id !== ROOT_ID)
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
        translations: translations({
          select: data
        })
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
      const children = childrenOf(
        graph,
        locale,
        row.data.workspace,
        row.data.root,
        row.id,
        visibleTypes,
        orderBy
      )
      const entries = [row.data].concat(row.translations)
      indexed.set(row.id, {
        id: row.id,
        type: row.type,
        index: row.index,
        entries,
        canDrag,
        children
      })
    }
    const res: Array<EntryTreeItem | undefined> = []
    for (const id of ids) {
      if (id === ROOT_ID) {
        res.push(
          await entryTreeRoot(
            graph,
            locale,
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
  children: Promise<Array<string>>
}

export function useEntryTreeProvider(): TreeDataLoader<EntryTreeItem> & {
  canDrag(item: Array<ItemInstance<EntryTreeItem>>): boolean
  canDrop(
    items: Array<ItemInstance<EntryTreeItem>>,
    target: DragTarget<EntryTreeItem>
  ): boolean
  onDrop(
    items: Array<ItemInstance<EntryTreeItem>>,
    target: DragTarget<EntryTreeItem>
  ): void
} {
  const loader = useAtomValue(loaderAtom)
  const db = useAtomValue(dbAtom)
  return useMemo(() => {
    return {
      canDrag(items) {
        return items.every(item => {
          const data = item.getItemData()
          return data.canDrag
        })
      },
      canDrop(items, target) {
        const {item: parent} = target
        if (items.length !== 1) return false
        const [dropping] = items
        const newParent = dropping.getParent() !== parent
        const parentData = parent.getItemData()
        const droppingData = dropping.getItemData()
        if (!droppingData) return false
        const childType = db.config.schema[droppingData.type]
        if (!parentData) return false
        if (parentData.type === ROOT_ID) {
          const entry = droppingData.entries[0]
          const root = db.config.workspaces[entry.workspace][entry.root]
          const orderBy = getRoot(root).orderChildrenBy
          return !newParent
            ? !orderBy
            : Config.rootContains(db.config, root, childType)
        }
        const parentType = db.config.schema[parentData.type]
        const orderBy = getType(parentType).orderChildrenBy
        return !newParent
          ? !orderBy
          : Config.typeContains(db.config, parentType, childType)
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
        const toRoot = parent.getId().startsWith('@alinea')
          ? dropping.getItemData().entries[0].root
          : undefined
        const toParent = !toRoot && newParent ? parent.getId() : undefined
        db.move({
          id: dropping.getId(),
          after,
          toParent,
          toRoot
        })
      },
      async getItem(id): Promise<EntryTreeItem> {
        const data = await loader.clear(id).load(id)
        if (!data) throw new Error(`Item ${id} not found`)
        return data
      },
      async getChildren(id): Promise<Array<string>> {
        return this.getItem(id).then(item => item?.children ?? [])
      }
    }
  }, [loader])
}
