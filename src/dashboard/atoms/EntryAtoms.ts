import {Database} from 'alinea/backend'
import {EntryPhase, Type} from 'alinea/core'
import {Page} from 'alinea/core/Page'
import {Realm} from 'alinea/core/pages/Realm'
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

export const findAtom = atom(async get => {
  const db = await get(localDbAtom)
  return db.find.bind(db)
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

const entryTreeRootAtom = atom(
  async (get): Promise<TreeItem<EntryTreeItem>> => {
    const find = await get(findAtom)
    const workspace = get(workspaceAtom)
    const root = get(rootAtom)
    const children = await find(
      Page()
        .where(
          Page.workspace.is(workspace.name),
          Page.root.is(root.name),
          Page.parent.isNull(),
          Page.active
        )
        .select(Page.entryId)
        .orderBy(Page.index.asc()),
      Realm.PreferDraft
    )
    return {
      index: ENTRY_TREE_ROOT_KEY,
      data: {
        title: 'Root',
        type: undefined!,
        entryId: undefined!,
        phase: undefined!
      },
      children
    }
  }
)

const entryTreeItemLoaderAtom = atom(async get => {
  const find = await get(findAtom)
  const entryTreeRootItem = await get(entryTreeRootAtom)
  const {schema} = get(configAtom)
  return new DataLoader(async (ids: ReadonlyArray<TreeItemIndex>) => {
    const res = new Map<TreeItemIndex, TreeItem<EntryTreeItem>>()
    const search = (ids as Array<string>).filter(
      id => id !== ENTRY_TREE_ROOT_KEY
    )
    const entries: Array<TreeItem<EntryTreeItem>> = await find(
      Page()
        .select({
          index: Page.entryId,
          data: {
            entryId: Page.entryId,
            type: Page.type,
            title: Page.title,
            phase: Page.phase
          },
          children({children}) {
            return children(Page).select(Page.entryId).orderBy(Page.index.asc())
          }
        })
        .where(Page.entryId.isIn(search)),
      Realm.PreferDraft
    )
    for (const entry of entries) res.set(entry.index, entry)
    return ids.map(id => {
      if (id === ENTRY_TREE_ROOT_KEY) return entryTreeRootItem
      const entry = res.get(id)!
      const type = schema[entry.data.type]
      const isFolder = Type.isContainer(type)
      return {...entry, isFolder}
    }) as typeof entries
  })
})

const loaderAtom = atom(get => {
  return {loader: get(entryTreeItemLoaderAtom)}
})

export interface EntryTreeItem {
  type: string
  entryId: string
  title: string
  phase: EntryPhase
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

export const previewTokenAtom = atom(async get => {
  const client = get(clientAtom)
  return client.previewToken()
})

export function usePreviewToken() {
  return useAtomValue(previewTokenAtom)
}
