import {Database} from 'alinea/backend'
import {EntryPhase, Type} from 'alinea/core'
import {Entry} from 'alinea/core/Entry'
import {Graph} from 'alinea/core/Graph'
import {Realm} from 'alinea/core/pages/Realm'
import {entries} from 'alinea/core/util/Objects'
import DataLoader from 'dataloader'
import {atom, useAtom, useAtomValue} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {MutableRefObject, useEffect, useMemo, useRef} from 'react'
import {TreeDataProvider, TreeItem, TreeItemIndex} from 'react-complex-tree'
import {createPersistentStore} from '../util/PersistentStore.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {rootAtom, workspaceAtom} from './NavigationAtoms.js'

export const storeAtom = atom(createPersistentStore)

export const localDbAtom = atom(async get => {
  const client = get(clientAtom)
  const config = get(configAtom)
  const store = await get(storeAtom)
  const db = new Database(store, config)
  await db.syncWith(client)
  await store.flush()
  return db
})

export const graphAtom = atom(async get => {
  const config = get(configAtom)
  const db = await get(localDbAtom)
  return {
    drafts: new Graph(config, params => {
      return db.resolve({
        ...params,
        realm: Realm.Draft
      })
    }),
    active: new Graph(config, params => {
      return db.resolve({
        ...params,
        realm: Realm.PreferDraft
      })
    }),
    all: new Graph(config, params => {
      return db.resolve({
        ...params,
        realm: Realm.All
      })
    })
  }
})

export const entryRevisionAtoms = atomFamily((id: string) => {
  const revision = atom(0)
  return atom(
    get => get(revision),
    (get, set) => set(revision, i => i + 1)
  )
})

export const changedEntriesAtom = atom<Array<string>>([])
export const updateDbAtom = atom(null, async (get, set) => {
  const client = get(clientAtom)
  const store = await get(storeAtom)
  const db = await get(localDbAtom)
  const changed = await db.syncWith(client).catch(() => [])
  if (!changed.length) return
  for (const id of changed) set(entryRevisionAtoms(id))
  set(changedEntriesAtom, changed)
  await store.flush()
})
updateDbAtom.onMount = update => {
  const interval = setInterval(update, 1000 * 60)
  return () => clearInterval(interval)
}

export function useDbUpdater() {
  useAtom(updateDbAtom)
}

export const ENTRY_TREE_ROOT_KEY = '@alinea/dashboard.entryTreeRoot'

const visibleTypesAtom = atom(get => {
  const {schema} = get(configAtom)
  return entries(schema)
    .filter(([_, type]) => !Type.meta(type).isHidden)
    .map(([name]) => name)
})

const entryTreeRootAtom = atom(
  async (get): Promise<TreeItem<EntryTreeItem>> => {
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
      index: ENTRY_TREE_ROOT_KEY,
      data: {entries: []},
      children
    }
  }
)

const entryTreeItemLoaderAtom = atom(async get => {
  const graph = await get(graphAtom)
  const entryTreeRootItem = await get(entryTreeRootAtom)
  const visibleTypes = get(visibleTypesAtom)
  return new DataLoader(async (ids: ReadonlyArray<TreeItemIndex>) => {
    const res = new Map<TreeItemIndex, TreeItem<EntryTreeItem>>()
    const search = (ids as Array<string>).filter(
      id => id !== ENTRY_TREE_ROOT_KEY
    )
    const data = {
      id: Entry.i18nId,
      type: Entry.type,
      title: Entry.title,
      phase: Entry.phase,
      locale: Entry.locale
    }
    const find = Entry()
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
    const rows = await graph.active.find(find)
    for (const row of rows) {
      const entries = [row.data].concat(row.translations)
      res.set(row.index, {
        index: row.index,
        data: {entries},
        children: row.children
      })
    }
    return ids.map(id => {
      if (id === ENTRY_TREE_ROOT_KEY) return entryTreeRootItem
      const entry = res.get(id)!
      return entry
    })
  })
})

const loaderAtom = atom(get => {
  // Don't return the Promise directly because that causes Jotai to suspend
  return {loader: get(entryTreeItemLoaderAtom)}
})

export interface EntryTreeItem {
  entries: Array<{
    id: string
    type: string
    title: string
    phase: EntryPhase
    locale: string | null
  }>
}

export function useEntryTreeProvider(): TreeDataProvider<EntryTreeItem> {
  const listener: MutableRefObject<(changedItemIds: TreeItemIndex[]) => void> =
    useRef(() => {})
  const changed = useAtomValue(changedEntriesAtom)
  const {loader} = useAtomValue(loaderAtom)
  useEffect(() => {
    listener.current?.([ENTRY_TREE_ROOT_KEY])
  }, [loader])
  useEffect(() => {
    listener.current?.(changed)
  }, [changed])
  return useMemo(() => {
    return {
      onDidChangeTreeData(_) {
        listener.current = _
        return {dispose: () => {}}
      },
      async getTreeItem(index: TreeItemIndex): Promise<TreeItem> {
        return (await loader).clear(index).load(index)
      },
      async getTreeItems(itemIds): Promise<Array<TreeItem>> {
        const items = await (await loader).clearAll().loadMany(itemIds)
        return items.filter(
          (item): item is TreeItem => item instanceof Error === false
        )
      }
    }
  }, [loader])
}
