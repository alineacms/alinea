import {Permission} from '#/core/Role.js'
import {atom, type Atom, type PrimitiveAtom} from 'jotai'
import {graphAtom} from './core.js'
import {
  incomingReferencesAtoms,
  type EntryReferenceWithSource
} from './entry.js'
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

/** Which languages of the entries are deleted and the links that will break */
export interface DeletePlan {
  subjects: Array<DeleteSubject>
  /** The languages of a single entry the user can pick to delete */
  locales: Array<string>
  /** The picked languages, the shown language at first */
  selectedLocales: PrimitiveAtom<Array<string>>
  removals: Atom<Array<DeleteRemoval>>
  /** The versions linking to the removed translations */
  references: Atom<Array<EntryReferenceWithSource>>
}

/**
 * Entries without languages are deleted entirely, the others in the picked
 * languages or, when there is nothing to pick, the language they are shown in.
 */
export function createDeletePlan(
  subjects: Array<DeleteSubject>,
  locales: Array<string>,
  references: Array<EntryReferenceWithSource>
): DeletePlan {
  const shown = subjects[0]?.locale
  const selectedLocales = atom(
    shown && locales.includes(shown) ? [shown] : Array<string>()
  )
  const removals = atom(get => {
    const selected = get(selectedLocales)
    return subjects.flatMap(({id, locale}): Array<DeleteRemoval> => {
      if (locale === null || locales.length === 0) return [{id, locale}]
      return selected.map(locale => ({id, locale}))
    })
  })
  return {
    subjects,
    locales,
    selectedLocales,
    removals,
    // References hold the language of the linking entry: links from an entry
    // without languages can point to any language
    references: atom(get => {
      const removed = get(removals)
      return references.filter(({reference}) =>
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
    locales: Array<string> = []
  ): Promise<DeletePlan> => {
    const policy = get(policyAtom)
    const [first] = subjects
    const loaded = await Promise.all(
      subjects.map(subject => get(incomingReferencesAtoms(subject.id)))
    )
    return createDeletePlan(
      subjects,
      locales.filter(locale => policy.canDelete({...first, locale})),
      loaded.flatMap(result => result.references)
    )
  }
)

export const deleteEntriesAtom = atom(
  null,
  async (get, _set, plan: DeletePlan) => {
    const policy = get(policyAtom)
    const removals = get(plan.removals)
    for (const {id, locale} of removals) {
      const subject = plan.subjects.find(subject => subject.id === id)
      policy.assert(Permission.Delete, {...subject, locale})
    }
    await get(graphAtom).mutate(
      removals.map(removal => ({op: 'remove', ...removal}))
    )
  }
)
