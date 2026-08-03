import {Entry, EntryStatus} from '#/core/Entry.js'
import {parseRecord} from '#/core/EntryRecord.js'
import {Permission} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {entries} from '#/core/util/Objects.js'
import {parents, translations} from '#/query.js'
import {Atom, atom, Getter, PrimitiveAtom} from 'jotai'
import {ReactiveNode} from '../store.js'
import {clientAtom, configAtom, graphAtom} from './core.js'
import {shaAtom} from './graph.js'
import {policyAtom, userAtom} from './user.js'
import {dispense, loader} from './utils.js'

export interface EntryAtoms {
  id: string
  type: string
  parentId: string | null
  workspace: string
  root: string
  locales: (locale: string | null) => EntryLocaleAtoms
}

export interface EntryLocaleAtoms extends Entry {
  currentlyEditing: PrimitiveAtom<ReactiveNode<object> | undefined>
  selectedVersion: PrimitiveAtom<SelectedVersion | null>
  selectedEntry: Atom<Promise<Entry>>
  selectedNode: Atom<Promise<ReactiveNode<object>>>
}

const selection = {
  id: Entry.id,
  type: Entry.type,
  parentId: Entry.parentId,
  workspace: Entry.workspace,
  root: Entry.root,
  parents: parents({
    select: {
      id: Entry.id,
      path: Entry.path,
      type: Entry.type,
      status: Entry.status,
      main: Entry.main
    }
  }),
  entries: translations({select: Entry, includeSelf: true})
}

export type SelectedVersion =
  | {type: 'status'; status: EntryStatus}
  | {type: 'history'; file: string; ref: string}

async function prepareData(
  get: Getter,
  node: ReactiveNode<object>,
  type: Type,
  action: 'update' | 'create'
) {
  const user = get(userAtom)
  const current = get(node.value) as Record<string, unknown>
  const data = Type.beforeSave(type, current, {
    action,
    user,
    now: new Date()
  })
  return {data, changed: data !== current}
}

export const entryAtoms = dispense(entryId => {
  const dataAtom = atom(async get => {
    get(shaAtom)
    const load = get(entryLoader)
    const [result, error] = await load(entryId)
    if (error) {
      // subscribe to entry revisions to update when entry synced
      if (error instanceof MissingEntryError) get(shaAtom)
      throw error
    }
    assert(result, `Entry "${entryId}" not found`)
    return result
  })

  const localeAtoms = dispense((locale: string | null) => {
    const currentlyEditing = atom<ReactiveNode<object>>()
    const selectedVersion = atom<SelectedVersion | null>(null)
    const selectedEntry = atom(async (get): Promise<Entry> => {
      const data = await get(dataAtom)
      const localeEntries = data.entries.filter(
        entry => entry.locale === locale
      )
      assert(localeEntries.length > 0, `No entry for locale "${locale}"`)
      const version = get(selectedVersion)
      if (!version) return localeEntries[0]
      if (version.type === 'status')
        return (
          localeEntries.find(entry => entry.status === version.status) ??
          localeEntries[0]
        )
      const client = get(clientAtom)
      const revision = await client.revisionData(version.file, version.ref)
      const activeEntry = localeEntries[0]
      if (!revision) return activeEntry
      const historyData = parseRecord(revision).data
      return {
        ...activeEntry,
        title:
          typeof historyData.title === 'string'
            ? historyData.title
            : activeEntry.title,
        path:
          typeof historyData.path === 'string'
            ? historyData.path
            : activeEntry.path,
        data: historyData
      }
    })
    const selectedNode = atom(async get => {
      const version = get(selectedVersion)
      const entry = await get(selectedEntry)
      if (!version || (version.type === 'status' && entry.active)) {
        const editing = get(currentlyEditing)
        if (editing) return editing
      }
      const config = get(configAtom)
      const type = config.schema[entry.type]
      assert(type, `Type "${entry.type}" not found in config`)
      const policy = get(policyAtom)
      const readOnly =
        version?.type === 'history' || !entry.active || !policy.canUpdate(entry)
      return new ReactiveNode<object>(
        Type.withInitialValue(type, {
          ...Type.initialValue(type),
          ...entry.data
        }),
        readOnly
      )
    })
    const saveDraft = atom(
      null,
      async (get, set, node: ReactiveNode<object>) => {
        const {id, type} = await get(dataAtom)
        const policy = get(policyAtom)
        const config = get(configAtom)
        const typeConfig = config.schema[type]
        const graph = get(graphAtom)
        const {data, changed} = await prepareData(
          get,
          node,
          typeConfig,
          'update'
        )
        policy.assert(Permission.Update, data)
        await graph.create({
          type: typeConfig,
          id,
          locale,
          status: 'draft',
          set: data,
          overwrite: true
        })
        if (changed) set(node.value, data)
        set(node.commit)
      }
    )
    return {
      currentlyEditing,
      selectedVersion,
      selectedEntry,
      selectedNode,
      saveDraft
    }
  })

  return atom(async get => {
    const data = await get(dataAtom)
    const entries = new Map(
      data.entries.map(entry => [entry.locale, entry] as const)
    )
    const locales = dispense((locale: string | null): EntryLocaleAtoms => {
      const entry = entries.get(locale)
      if (!entry) {
        const fallbackLocale = data.entries[0].locale
        return locales(fallbackLocale)
      }
      return {...entry, ...localeAtoms(locale)}
    })
    return {
      ...data,
      locales
    }
  })
})

const entryLoader = atom(get => {
  const config = get(configAtom)
  const graph = get(graphAtom)
  const policy = get(policyAtom)
  const visibleTypes = entries(config.schema)
    .filter(([, type]) => !Type.isHidden(type))
    .map(([name]) => name)
  return loader(async ids => {
    const rows = await graph.find({
      groupBy: Entry.id,
      select: selection,
      id: {in: ids},
      status: 'preferDraft'
    })
    const parentIds = await graph.find({
      select: Entry.parentId,
      parentId: {in: ids},
      filter: {_type: {in: visibleTypes}},
      groupBy: Entry.parentId,
      status: 'preferDraft'
    })
    const byId = new Map(rows.map(row => [row.id, row] as const))
    return ids.map(id => {
      const row = byId.get(id)
      if (!row) return [null, new MissingEntryError(id)] as const
      const readableEntries = row.entries.filter(entry => policy.canRead(entry))
      if (readableEntries.length === 0)
        return [null, new MissingEntryError(id)] as const
      return [
        {
          ...row,
          entries: readableEntries,
          hasChildren: parentIds.includes(id)
        },
        null
      ] as const
    })
  })
})

export class MissingEntryError extends Error {
  constructor(public id: string) {
    super(`Missing entry ${id}`)
    this.name = 'MissingEntryError'
  }
}
