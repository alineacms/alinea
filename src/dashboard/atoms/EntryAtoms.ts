import {
  AsyncTreeDataLoader,
  DropTarget,
  ItemInstance
} from '@headless-tree/core'
import {Entry} from 'alinea/core/Entry'
import {EntryStatus} from 'alinea/core/EntryRow'
import {Graph} from 'alinea/core/Graph'
import {getType} from 'alinea/core/Internal'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {Type} from 'alinea/core/Type'
import {entryFileName} from 'alinea/core/util/EntryFilenames'
import {
  generateKeyBetween,
  generateNKeysBetween
} from 'alinea/core/util/FractionalIndexing'
import {entries} from 'alinea/core/util/Objects'
import DataLoader from 'dataloader'
import {atom, useAtomValue} from 'jotai'
import {useMemo} from 'react'
import {useDashboard} from '../hook/UseDashboard.js'
import {configAtom} from './DashboardAtoms.js'
import {graphAtom, useMutate} from './DbAtoms.js'
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
  root: string,
  visibleTypes: Array<string>
): Promise<EntryTreeItem> {
  const children = await graph.find({
    select: Entry.i18nId,
    groupBy: Entry.i18nId,
    orderBy: {asc: Entry.index, caseSensitive: true},
    filter: {
      _active: true,
      _workspace: workspace,
      _root: root,
      _parentId: null,
      _type: {in: visibleTypes}
    },
    status
  })
  return {
    id: rootId(root),
    index: '',
    type: '',
    isFolder: true,
    entries: [],
    children
  }
}

const entryTreeItemLoaderAtom = atom(async get => {
  const graph = await get(graphAtom)
  const locale = get(localeAtom)
  const visibleTypes = get(visibleTypesAtom)
  const {schema} = get(configAtom)
  const root = get(rootAtom)
  const workspace = get(workspaceAtom)
  return new DataLoader(async (ids: ReadonlyArray<string>) => {
    const indexed = new Map<string, EntryTreeItem>()
    const search = (ids as Array<string>).filter(id => id !== rootId(root.name))
    const data = {
      id: Entry.i18nId,
      entryId: Entry.id,
      type: Entry.type,
      title: Entry.title,
      status: Entry.status,
      locale: Entry.locale,
      workspace: Entry.workspace,
      root: Entry.root,
      path: Entry.path,
      parentPaths: {
        parents: {},
        select: Entry.path
      }
    }
    const rows = await graph.find({
      groupBy: Entry.i18nId,
      select: {
        id: Entry.i18nId,
        entryId: Entry.id,
        index: Entry.index,
        type: Entry.type,
        data,
        translations: {
          translations: {},
          select: data
        }
      },
      i18nId: {in: search},
      status: 'preferDraft'
    })
    for (const row of rows) {
      const type = schema[row.type]
      const orderBy = getType(type).orderChildrenBy ?? {
        asc: Entry.index,
        caseSensitive: true
      }
      const ids = row.translations.map(row => row.entryId).concat(row.entryId)
      const children = await graph.find({
        select: {
          locale: Entry.locale,
          i18nId: Entry.i18nId
        },
        orderBy,
        filter: {
          _parentId: {in: ids},
          _type: {in: visibleTypes}
        },
        status: 'preferDraft'
      })
      const entries = [row.data].concat(row.translations)
      const translatedChildren = new Set(
        children
          .filter(child => child.locale === locale)
          .map(child => child.i18nId)
      )
      const untranslated = new Set()
      const orderedChildren = children.filter(child => {
        if (translatedChildren.has(child.i18nId)) return child.locale === locale
        if (untranslated.has(child.i18nId)) return false
        untranslated.add(child.i18nId)
        return true
      })
      indexed.set(row.id, {
        id: row.id,
        type: row.type,
        index: row.index,
        entries,
        children: [...new Set(orderedChildren.map(child => child.i18nId))]
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
    entryId: string
    type: string
    title: string
    status: EntryStatus
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
  const mutate = useMutate()
  const {config} = useDashboard()
  return useMemo(() => {
    return {
      onDrop(items, {item: parent, childIndex, insertionIndex}) {
        if (items.length !== 1) return
        const [dropping] = items
        if (childIndex === null) return
        if (dropping.getParent() !== parent) {
          console.warn('Todo: move entries')
          return
        }
        const children = parent.getChildren()
        const previous = children[childIndex - 1]
        const previousIndexKey = previous?.getItemData()?.index ?? null
        const next = children
          .slice(childIndex)
          .find(
            entry => !entry || entry?.getItemData().index !== previousIndexKey
          )
        const nextChildIndex = next ? children.indexOf(next) : undefined
        const nextIndexKey = next?.getItemData()?.index ?? null

        try {
          const brokenChildren = children.slice(childIndex, nextChildIndex)
          const newIndexKey = generateKeyBetween(previousIndexKey, nextIndexKey)
          const mutations: Array<Mutation> = []

          if (brokenChildren.length > 0) {
            // Start by generating new, clean keys for broken children (children with duplicate keys)
            const newKeys = generateNKeysBetween(
              newIndexKey,
              nextIndexKey,
              brokenChildren.length
            )
            for (let i = 0; i < brokenChildren.length; i++) {
              const child = brokenChildren[i]
              const correctedIndexKey = newKeys[i]
              for (const entry of child.getItemData().entries) {
                mutations.push({
                  type: MutationType.Order,
                  entryId: entry.entryId,
                  file: entryFileName(config, entry, entry.parentPaths),
                  index: correctedIndexKey
                })
              }
            }
          }

          for (const entry of dropping.getItemData().entries) {
            mutations.push({
              type: MutationType.Order,
              entryId: entry.entryId,
              file: entryFileName(config, entry, entry.parentPaths),
              index: newIndexKey
            })
          }
          mutate(mutations, true)
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
