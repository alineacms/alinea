import {
  AsyncTreeDataLoader,
  DropTarget,
  ItemInstance
} from '@headless-tree/core'
import {Root} from 'alinea/alinea'
import {Entry} from 'alinea/core/Entry'
import {EntryStatus} from 'alinea/core/EntryRow'
import {Graph} from 'alinea/core/Graph'
import {getRoot, getType} from 'alinea/core/Internal'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {Type} from 'alinea/core/Type'
import {entryFileName} from 'alinea/core/util/EntryFilenames'
import {
  generateKeyBetween,
  generateNKeysBetween
} from 'alinea/core/util/FractionalIndexing'
import {entries} from 'alinea/core/util/Objects'
import {parents} from 'alinea/query'
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
  rootName: string,
  visibleTypes: Array<string>
): Promise<EntryTreeItem> {
  const root = graph.config.workspaces[workspace][rootName]
  const orderBy = getRoot(root).orderChildrenBy ?? {
    asc: Entry.index,
    caseSensitive: true
  }
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
      const orderBy = getType(type).orderChildrenBy ?? {
        asc: Entry.index,
        caseSensitive: true
      }
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
  const mutate = useMutate()
  const {config} = useDashboard()
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
        if (childIndex === null) return
        const fromParent = dropping.getParent()
        const toParent = parent
        const isMove = fromParent !== toParent

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
                  entryId: entry.id,
                  file: entryFileName(
                    config,
                    entry,
                    entry.parents.map(p => p.path)
                  ),
                  index: correctedIndexKey
                })
              }
            }
          }

          for (const entry of dropping.getItemData().entries) {
            if (isMove) {
              // Things we need to check for a valid move:
              // 1) The parent we are moving into is either the root OR a folder entry which can accept children
              // 2) If the parent we are moving to is a folder, it should be translated to all the same locales as the subject we are dropping
              // 3) The parent we are moving to should accept this kind of channel
              // 4) The parent we are moving to should not be a child of the subject we are moving

              if (toParent.getItemData() === null) {
                const workspaceConfig = config.workspaces[entry.workspace]
                const {contains} = Root.data(workspaceConfig[entry.root])
                if (contains && contains.includes(entry.type)) {
                  const message = `Cannot move entry to root because it does not support ${entry.type} as a child`
                  alert(message)
                  throw new Error(message)
                }

                const fromFile = entryFileName(config, entry, entry.parentPaths)
                const toFile = entryFileName(config, entry, [])
                mutations.push({
                  type: MutationType.Move,
                  entryId: entry.entryId,
                  entryType: entry.type,
                  fromFile,
                  toFile,
                  parent: null,
                  root: entry.root,
                  workspace: entry.workspace,
                  index: newIndexKey
                })
              } else {
                const movingTo = toParent.getItemData()
                const parentInLocale = movingTo.entries?.find(
                  e => e.locale === entry.locale
                )
                if (!parentInLocale) {
                  const message = `Cannot move entry to ${movingTo.entries[0]?.title} because it is not translated to ${entry.locale}`
                  alert(message)
                  throw new Error(message)
                }

                const parentType = config.schema[entry.type]
                const isContainer = Type.isContainer(parentType)
                if (!isContainer) {
                  const message = `Cannot move entry to ${movingTo.entries[0]?.title} because it is not a container`
                  alert(message)
                  throw new Error(message)
                }

                const typeConfig = Type.meta(config.schema[movingTo.type])
                if (
                  typeConfig.contains &&
                  !typeConfig.contains.includes(entry.type)
                ) {
                  const message = `Cannot move entry to ${movingTo.entries[0]?.title} because it does not support ${entry.type} as a child`
                  alert(message)
                  throw new Error(message)
                }

                if (
                  [...parentInLocale.parentPaths, parentInLocale.path]
                    .join('/')
                    .startsWith([...entry.parentPaths, entry.path].join('/'))
                ) {
                  const message = `Cannot move entry to ${movingTo.entries[0]?.title} because it is a child of the entry`
                  alert(message)
                  throw new Error(message)
                }

                const fromFile = entryFileName(config, entry, entry.parentPaths)
                const toFile = entryFileName(
                  config,
                  entry,
                  parentInLocale.parentPaths.concat(parentInLocale.path)
                )

                mutations.push({
                  type: MutationType.Move,
                  entryId: entry.entryId,
                  entryType: entry.type,
                  fromFile,
                  toFile,
                  parent: parentInLocale.entryId,
                  root: parentInLocale.root,
                  workspace: parentInLocale.workspace,
                  index: newIndexKey
                })
              }

              // TODO 1: it looks like the index defined in a move mutation is not applied
              // TODO 2: when move mutations are applied, the frontend crashes and needs a refresh
            } else {
              mutations.push({
                type: MutationType.Order,
                entryId: entry.entryId,
                file: entryFileName(config, entry, entry.parentPaths),
                index: newIndexKey
              })
            }
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
