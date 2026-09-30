import {Entry} from '#/core/Entry.js'
import {atom, type Atom, type PrimitiveAtom} from 'jotai'
import {graphAtom} from './core.js'
import {loadIncomingReferences, type EntryReferenceWithSource} from './entry.js'
import {policyAtom} from './user.js'

/** An entry that is about to be deleted, in the locale it is shown in */
export interface DeleteSubject {
  id: string
  title: string
  type: string
  workspace: string
  root: string
  /** Null for entries without languages */
  locale: string | null
  parents: Array<string>
  hasChildren: boolean
}

/** A translation that is removed, a null locale removes every version */
export interface DeleteRemoval {
  id: string
  locale: string | null
}

/** An entry that is deleted with the translation of its parent */
export interface DeleteDescendant extends DeleteRemoval {
  subjectId: string
}

/** Which languages of the entries are deleted and the links that will break */
export interface DeletePlan {
  subjects: Array<DeleteSubject>
  /** The languages of a single entry the user can pick to delete, undefined
   * for a batch */
  locales?: Array<string>
  /** The picked languages, the shown language at first */
  selectedLocales: PrimitiveAtom<Array<string>>
  removals: Atom<Array<DeleteRemoval>>
  /** The versions linking to the removed translations and their contents,
   * that are not removed themselves */
  references: Atom<Array<EntryReferenceWithSource>>
}

/**
 * Entries without languages are deleted entirely, the others in the picked
 * languages or, in a batch, the language they are shown in.
 */
export function createDeletePlan(
  subjects: Array<DeleteSubject>,
  locales: Array<string> | undefined,
  references: Array<EntryReferenceWithSource>,
  descendants: Array<DeleteDescendant> = []
): DeletePlan {
  const shown = subjects[0]?.locale
  const selectedLocales = atom(
    shown && locales?.includes(shown) ? [shown] : Array<string>()
  )
  const removals = atom(get => {
    const selected = get(selectedLocales)
    return subjects.flatMap(({id, locale}): Array<DeleteRemoval> => {
      if (locale === null || !locales) return [{id, locale}]
      return selected.map(locale => ({id, locale}))
    })
  })
  return {
    subjects,
    locales,
    selectedLocales,
    removals,
    references: atom(get => {
      const removed = get(removals).flatMap(removal => [
        removal,
        ...descendants.filter(
          ({subjectId, locale}) =>
            subjectId === removal.id && locale === removal.locale
        )
      ])
      return references.filter(
        ({reference}) =>
          !removed.some(
            ({id, locale}) =>
              id === reference.sourceId && locale === reference.sourceLocale
          ) &&
          // References hold the language of the linking entry: links from an
          // entry without languages can point to any language
          removed.some(
            ({id, locale}) =>
              id === reference.targetId &&
              (locale === null ||
                reference.sourceLocale === null ||
                locale === reference.sourceLocale)
          )
      )
    })
  }
}

/** Loads the references to the entries before the delete dialog opens */
export const loadDeletePlanAtom = atom(
  null,
  async (
    get,
    _set,
    subjects: Array<DeleteSubject>,
    locales?: Array<string>
  ): Promise<DeletePlan> => {
    const policy = get(policyAtom)
    const [first] = subjects
    const versions = await get(graphAtom).find({
      id: {in: subjects.map(subject => subject.id)},
      status: 'all',
      select: {
        id: Entry.id,
        locale: Entry.locale,
        descendants: {
          edge: 'children',
          // The deepest level queried, queries are sent as JSON
          depth: 999,
          status: 'all',
          select: Entry.id
        }
      }
    })
    const descendants = versions.flatMap(version =>
      version.descendants.map(id => ({
        id,
        locale: version.locale,
        subjectId: version.id
      }))
    )
    const targetIds = new Set(
      subjects.map(subject => subject.id).concat(descendants.map(d => d.id))
    )
    const {references} = await loadIncomingReferences(
      get,
      Array.from(targetIds)
    )
    return createDeletePlan(
      subjects,
      locales?.filter(locale => policy.canDelete({...first, locale})),
      references,
      descendants
    )
  }
)

export const deleteEntriesAtom = atom(
  null,
  async (get, _set, plan: DeletePlan) => {
    await get(graphAtom).mutate(
      get(plan.removals).map(removal => ({op: 'remove', ...removal}))
    )
  }
)
