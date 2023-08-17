import {
  AsyncTreeDataLoader,
  DropTarget,
  ItemInstance
} from '@headless-tree/core'
import {EntryPhase, Type} from 'alinea/core'
import {Entry} from 'alinea/core/Entry'
import {entryFileName} from 'alinea/core/EntryFilenames'
import {GraphRealm} from 'alinea/core/Graph'
import {MutationType} from 'alinea/core/Mutation'
import {Projection} from 'alinea/core/pages/Projection'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {entries} from 'alinea/core/util/Objects'
import DataLoader from 'dataloader'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {useMemo} from 'react'
import {useDashboard} from '../hook/UseDashboard.js'
import {configAtom} from './DashboardAtoms.js'
import {graphAtom, mutateAtom} from './DbAtoms.js'
import {rootAtom, workspaceAtom} from './NavigationAtoms.js'

export function rootId(rootName: string) {
  return `@alinea/root-${rootName}`
}

const visibleTypesAtom = atom(get => {
  const {schema} = get(configAtom)
  return entries(schema)
    .filter(([_, type]) => !Type.meta(type).isHidden)
    .map(([name]) => name)
})

async function entryTreeRoot(
  active: GraphRealm,
  workspace: string,
  root: string,
  visibleTypes: Array<string>
): Promise<EntryTreeItem> {
  const rootEntries = Entry()
    .where(
      Entry.workspace.is(workspace),
      Entry.root.is(root),
      Entry.parent.isNull(),
      Entry.active,
      Entry.type.isIn(visibleTypes)
    )
    .select(Entry.i18nId)
    .groupBy(Entry.i18nId)
    .orderBy(Entry.index.asc())
  const children = await active.find(rootEntries)
  return {
    id: rootId(root),
    index: '',
    isFolder: true,
    entries: [],
    children
  }
}

const entryTreeItemLoaderAtom = atom(async get => {
  const graph = await get(graphAtom)
  const visibleTypes = get(visibleTypesAtom)
  const {schema} = get(configAtom)
  const root = get(rootAtom)
  const workspace = get(workspaceAtom)
  return new DataLoader(async (ids: ReadonlyArray<string>) => {
    const indexed = new Map<string, EntryTreeItem>()
    const search = (ids as Array<string>).filter(id => id !== rootId(root.name))
    const data = {
      id: Entry.i18nId,
      entryId: Entry.entryId,
      type: Entry.type,
      title: Entry.title,
      phase: Entry.phase,
      locale: Entry.locale,
      workspace: Entry.workspace,
      root: Entry.root,
      path: Entry.path,
      parentPaths({parents}) {
        return parents(Entry).select(Entry.path)
      },
      children({children}) {
        return children(Entry)
          .where(Entry.type.isIn(visibleTypes))
          .select(Entry.i18nId)
          .groupBy(Entry.i18nId)
          .orderBy(Entry.index.asc())
      }
    } satisfies Projection
    const entries = Entry()
      .select({
        id: Entry.i18nId,
        index: Entry.index,
        data,
        translations({translations}) {
          return translations().select(data)
        }
      })
      .groupBy(Entry.i18nId)
      .where(Entry.i18nId.isIn(search))
    const rows = await graph.active.find(entries)
    for (const row of rows) {
      const entries = [row.data].concat(row.translations)
      indexed.set(row.id, {
        id: row.id,
        index: row.index,
        entries,
        children: [...new Set(entries.flatMap(entry => entry.children))]
      })
    }
    const res: Array<EntryTreeItem | undefined> = []
    for (const id of ids) {
      if (id === rootId(root.name)) {
        res.push(
          await entryTreeRoot(
            graph.active,
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
  entries: Array<{
    id: string
    entryId: string
    type: string
    title: string
    phase: EntryPhase
    locale: string | null
    workspace: string
    root: string
    path: string
    parentPaths: Array<string>
  }>
  isFolder?: boolean
  children: Array<string>
}

export function useEntryTreeProvider(): AsyncTreeDataLoader<EntryTreeItem> & {
  onDrop(
    items: Array<ItemInstance<EntryTreeItem>>,
    target: DropTarget<EntryTreeItem>
  ): void
} {
  const {loader} = useAtomValue(loaderAtom)
  const mutate = useSetAtom(mutateAtom)
  const {config} = useDashboard()
  return useMemo(() => {
    return {
      onDrop(items, {item: parent, childIndex, insertionIndex}) {
        if (items.length !== 1) return
        const [dropping] = items
        if (childIndex === null) return
        if (dropping.getParent() !== parent) {
          console.log('Todo: move entries')
          return
        }
        const previous = parent.getChildren()[childIndex - 1]
        const next = parent.getChildren()[childIndex]
        const previousIndex = previous?.getItemData()?.index ?? null
        const nextIndex = next?.getItemData()?.index ?? null
        try {
          const newIndex = generateKeyBetween(previousIndex, nextIndex)
          for (const entry of dropping.getItemData().entries) {
            mutate({
              type: MutationType.Order,
              entryId: entry.entryId,
              file: entryFileName(config, entry, entry.parentPaths),
              index: newIndex
            })
          }
        } catch (err) {
          console.error(err)
        }
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
