import {
  AsyncTreeDataLoader,
  DropTarget,
  ItemInstance
} from '@headless-tree/core'
import {Root} from 'alinea/alinea'
import {Entry} from 'alinea/core/Entry'
import {EntryPhase} from 'alinea/core/EntryRow'
import {GraphRealm} from 'alinea/core/Graph'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {Type} from 'alinea/core/Type'
import {Projection} from 'alinea/core/pages/Projection'
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
      }
      /*children({children}) {
        return children(Entry)
          .where(Entry.type.isIn(visibleTypes))
          .select(Entry.i18nId)
          .groupBy(Entry.i18nId)
          .orderBy(Entry.index.asc())
      }*/
    } satisfies Projection
    const entries = Entry()
      .select({
        id: Entry.i18nId,
        entryId: Entry.entryId,
        index: Entry.index,
        type: Entry.type,
        data,
        translations({translations}) {
          return translations().select(data)
        }
      })
      .groupBy(Entry.i18nId)
      .where(Entry.i18nId.isIn(search))
    const rows = await graph.preferDraft.find(entries)
    for (const row of rows) {
      const type = schema[row.type]
      const orderBy = Type.meta(type).orderChildrenBy ?? Entry.index.asc()
      const ids = row.translations.map(row => row.entryId).concat(row.entryId)
      const children = await graph.preferDraft.find(
        Entry()
          .where(Entry.parent.isIn(ids), Entry.type.isIn(visibleTypes))
          .select({locale: Entry.locale, i18nId: Entry.i18nId})
          .orderBy(orderBy)
      )
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
            graph.preferDraft,
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
  const mutate = useMutate()
  const {config} = useDashboard()
  return useMemo(() => {
    return {
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
                  entryId: entry.entryId,
                  file: entryFileName(config, entry, entry.parentPaths),
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
