import {AsyncTreeDataLoader} from '@headless-tree/core'
import {EntryPhase, Type} from 'alinea/core'
import {Entry} from 'alinea/core/Entry'
import {entries} from 'alinea/core/util/Objects'
import DataLoader from 'dataloader'
import {atom, useAtomValue} from 'jotai'
import {useMemo} from 'react'
import {configAtom} from './DashboardAtoms.js'
import {graphAtom} from './DbAtoms.js'
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

const entryTreeRootAtom = atom(async (get): Promise<EntryTreeItem> => {
  const {active} = await get(graphAtom)
  const workspace = get(workspaceAtom)
  const root = get(rootAtom)
  const visibleTypes = get(visibleTypesAtom)
  const rootEntries = Entry()
    .where(
      Entry.workspace.is(workspace.name),
      Entry.root.is(root.name),
      Entry.parent.isNull(),
      Entry.active,
      Entry.type.isIn(visibleTypes)
    )
    .select(Entry.i18nId)
    .groupBy(Entry.i18nId)
    .orderBy(Entry.index.asc())
  const children = await active.find(rootEntries)
  return {
    id: rootId(root.name),
    isFolder: true,
    entries: [],
    children
  }
})

const entryTreeItemLoaderAtom = atom(async get => {
  const graph = await get(graphAtom)
  const entryTreeRootItem = await get(entryTreeRootAtom)
  const visibleTypes = get(visibleTypesAtom)
  const {schema} = get(configAtom)
  const root = get(rootAtom)
  return new DataLoader(async (ids: ReadonlyArray<string>) => {
    const res = new Map<string, EntryTreeItem>()
    const search = (ids as Array<string>).filter(id => id !== rootId(root.name))
    const data = {
      id: Entry.i18nId,
      type: Entry.type,
      title: Entry.title,
      phase: Entry.phase,
      locale: Entry.locale
    }
    const entries = Entry()
      .select({
        index: Entry.i18nId,
        data,
        translations({translations}) {
          return translations().select(data)
        },
        children({children}) {
          return children(Entry)
            .where(Entry.type.isIn(visibleTypes))
            .select(Entry.i18nId)
            .groupBy(Entry.i18nId)
            .orderBy(Entry.index.asc())
        }
      })
      .groupBy(Entry.i18nId)
      .where(Entry.i18nId.isIn(search))
    const rows = await graph.active.find(entries)
    console.log(rows)
    for (const row of rows) {
      const entries = [row.data].concat(row.translations)
      res.set(row.index, {
        id: row.index,
        entries,
        children: row.children
      })
    }
    return ids.map(id => {
      if (id === rootId(root.name)) return entryTreeRootItem
      const entry = res.get(id)!
      const typeName = entry.entries[0].type
      const type = schema[typeName]
      const isFolder = Type.isContainer(type)
      return {...entry, isFolder}
    })
  })
})

const loaderAtom = atom(get => {
  // Don't return the Promise directly because that causes Jotai to suspend
  return {loader: get(entryTreeItemLoaderAtom)}
})

export interface EntryTreeItem {
  id: string
  entries: Array<{
    id: string
    type: string
    title: string
    phase: EntryPhase
    locale: string | null
  }>
  isFolder?: boolean
  children: Array<string>
}

export function useEntryTreeProvider(): AsyncTreeDataLoader<EntryTreeItem> {
  const {loader} = useAtomValue(loaderAtom)
  return useMemo(() => {
    return {
      async getItem(id: string): Promise<EntryTreeItem> {
        return (await loader).clear(id).load(id)
      },
      async getChildren(id: string): Promise<Array<string>> {
        return this.getItem(id).then(item => item.children)
      }
    }
  }, [loader])
}
