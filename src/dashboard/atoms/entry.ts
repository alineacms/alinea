import {Entry, EntryStatus} from '#/core/Entry.js'
import {Infer} from '#/core/Infer.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {entries} from '#/core/util/Objects.js'
import {parents, translations} from '#/query.js'
import {atom} from 'jotai'
import {configAtom, graphAtom} from './core.js'
import {shaAtom} from './graph.js'
import {policyAtom} from './user.js'
import {dispense, loader} from './utils.js'

export interface EntryAtoms {
  id: string
  type: string
  parentId: string | null
  workspace: string
  root: string
  locales: Map<string | null, Entry>
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

type Selection = Infer<typeof selection>

/*class EntryState {
  #selection: Selection
  locales: Map<string | null, Entry>
  constructor(selection: Selection) {
    this.#selection = selection
    this.locales = new Map(
      selection.entries.map(entry => {
        return [entry.locale, entry]
      })
    )
  }
  get type() {
    return this.#selection.type
  }
  get id() {
    return this.#selection.id
  }
  get parentId() {
    return this.#selection.parentId
  }
  get workspace() {
    return this.#selection.workspace
  }
  get root() {
    return this.#selection.root
  }
}*/

type SelectedVersion =
  | {type: 'status'; status: EntryStatus}
  | {type: 'history'; file: string; ref: string}

export const entryAtoms = dispense(entryId => {
  const localeAtoms = dispense((locale: string | null) => {
    return {
      selectedVersion: atom<SelectedVersion | null>(null)
    }
  })
  return atom(async get => {
    const load = get(entryLoader)
    const [result, error] = await load(entryId)
    if (error) {
      // subscribe to entry revisions to update when entry synced
      if (error instanceof MissingEntryError) get(shaAtom)
      throw error
    }
    assert(result, `Entry "${entryId}" not found`)
    const versions = new Map(
      result.entries.map(entry => {
        return [entry.locale, entry]
      })
    )
    const locales = dispense((locale: string | null): Entry => {
      const entry = versions.get(locale)
      if (!entry) {
        const fallbackLocale = result.entries[0].locale
        return locales(fallbackLocale)
      }
      return {...entry, ...localeAtoms(locale)}
    })
    return {
      ...result,
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
