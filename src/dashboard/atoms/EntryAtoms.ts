import {Database} from 'alinea/backend'
import {Type} from 'alinea/core'
import {Page} from 'alinea/core/pages/Page'
import DataLoader from 'dataloader'
import {atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import {atomFamily, useHydrateAtoms} from 'jotai/utils'
import {MutableRefObject, useEffect, useMemo, useRef} from 'react'
import {TreeDataProvider, TreeItem, TreeItemIndex} from 'react-complex-tree'
import {keepPreviousData} from '../util/KeepPreviousData.js'
import {createPersistentStore} from '../util/PersistentStore.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {EntryEditor, createEntryEditor} from './EntryEditor.js'
import {rootAtom, workspaceAtom} from './NavigationAtoms.js'

export const storeAtom = atom(createPersistentStore)

export const dbAtom = atom(async get => {
  const client = get(clientAtom)
  const store = await get(storeAtom)
  const db = new Database(store, client.config)
  await db.syncWith(client)
  await store.flush()
  return db
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
  const db = await get(dbAtom)
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

export const selectedEntryId = atom<string | undefined>(undefined)

export const entryEditor = keepPreviousData(
  atom(async get => {
    const config = get(configAtom)
    const entryId = get(selectedEntryId)
    const db = await get(dbAtom)
    if (!entryId) return undefined
    get(entryRevisionAtoms(entryId))
    const versions = await db.find(
      Page({entryId}).select({
        ...Page,
        parents({parents}) {
          return parents(Page).select(Page.entryId)
        }
      })
    )
    return createEntryEditor(entryId, versions, config)
  })
)

export const useEntryEditor = (
  id: string | undefined
): EntryEditor | undefined => {
  useHydrateAtoms([[selectedEntryId, id]])
  const setEntryId = useSetAtom(selectedEntryId)
  const editor = useAtomValue(entryEditor)
  useEffect(() => setEntryId(id), [id])
  return editor
}

export const ENTRY_TREE_ROOT_KEY = '@alinea/dashboard.entryTreeRoot'

const entryTreeRootAtom = atom(
  async (get): Promise<TreeItem<EntryTreeItem>> => {
    const db = await get(dbAtom)
    const workspace = get(workspaceAtom)
    const root = get(rootAtom)
    const children = await db.find(
      Page()
        .where(
          Page.workspace.is(workspace.name),
          Page.root.is(root.name),
          Page.parent.isNull()
        )
        .select(Page.entryId)
        .groupBy(Page.entryId)
        .orderBy(Page.index.asc())
    )
    return {
      index: ENTRY_TREE_ROOT_KEY,
      data: {
        title: 'Root',
        type: undefined!,
        entryId: undefined!
      },
      children
    }
  }
)

const entryTreeItemLoaderAtom = atom(async get => {
  const db = await get(dbAtom)
  const entryTreeRootItem = await get(entryTreeRootAtom)
  const {schema} = get(configAtom)
  return new DataLoader(async (ids: ReadonlyArray<TreeItemIndex>) => {
    const res = new Map<TreeItemIndex, TreeItem<EntryTreeItem>>()
    const search = (ids as Array<string>).filter(
      id => id !== ENTRY_TREE_ROOT_KEY
    )
    const entries: Array<TreeItem<EntryTreeItem>> = await db.find(
      Page()
        .select({
          index: Page.entryId,
          data: {
            entryId: Page.entryId,
            type: Page.type,
            title: Page.title
          },
          children({children}) {
            return children(Page).select(Page.entryId).orderBy(Page.index.asc())
          }
        })
        .groupBy(Page.entryId)
        .orderBy(Page.modifiedAt.desc())
        .where(Page.entryId.isIn(search))
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

export interface EntryTreeItem {
  type: string
  entryId: string
  title: string
}

export function useEntryTreeProvider(): TreeDataProvider<EntryTreeItem> {
  const listener: MutableRefObject<(changedItemIds: TreeItemIndex[]) => void> =
    useRef(() => {})
  const changed = useAtomValue(changedEntriesAtom)
  const loader = useAtomValue(entryTreeItemLoaderAtom)
  useEffect(() => {
    listener.current?.(changed)
  }, [changed])
  return useMemo(() => {
    console.log('create new provider')
    return {
      onDidChangeTreeData(_) {
        listener.current = _
        return {dispose: () => {}}
      },
      async getTreeItem(index: TreeItemIndex): Promise<TreeItem> {
        return loader.clear(index).load(index)
      },
      async getTreeItems(itemIds): Promise<Array<TreeItem>> {
        const items = await loader.clearAll().loadMany(itemIds)
        return items.filter(
          (item): item is TreeItem => item instanceof Error === false
        )
      }
    }
  }, [])
}
