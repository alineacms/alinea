import type {Config} from '#/core/Config.js'
import type {EntryReference} from '#/core/db/EntryReference.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {Entry} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import type {Filter} from '#/core/Filter.js'
import {getWorkspace} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import type {Policy} from '#/core/Role.js'
import {Root} from '#/core/Root.js'
import type {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {dataWithUrlAliases, hasUrlAliases} from '#/database/EntryUrlAliases.js'
import {atom, type Atom, type Getter, type PrimitiveAtom} from 'jotai'
import {atomWithStorage, createJSONStorage} from 'jotai/utils'
import {configAtom, graphAtom} from './core.js'
import {loadIncomingReferences, type EntryReferenceWithSource} from './entry.js'
import type {ExplorerItemData, ExplorerLimitLocation} from './explorer.js'
import {policyAtom} from './user.js'

/** Deleting removes the entries, archiving unpublishes them until restored */
export type RemoveAction = 'delete' | 'archive'

/** An entry that is about to be removed, in the locale it is shown in */
export interface RemoveSubject {
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
export interface Removal {
  id: string
  locale: string | null
}

/** An entry that is removed with the translation of its parent */
export interface RemovedDescendant extends Removal {
  subjectId: string
}

/** The public URL of a removed translation of a page */
export interface RemovedUrl extends Removal {
  url: string
}

/** The page the URLs of the removed pages redirect to */
export interface RedirectTarget {
  id: string
  title: string
  url: string
  /** The languages of its versions, null for an entry without languages */
  locales: Array<string | null>
}

/** Which languages of the entries are removed and the links that will break */
export interface RemovePlan {
  subjects: Array<RemoveSubject>
  /** The languages of a single entry the user can pick to delete, undefined
   * for a batch */
  locales?: Array<string>
  /** The picked languages, the shown language at first */
  selectedLocales: PrimitiveAtom<Array<string>>
  removals: Atom<Array<Removal>>
  /** The versions linking to the removed translations and their contents,
   * that are not removed themselves */
  references: Atom<Array<EntryReferenceWithSource>>
  /** How many entries the user can not read link to them, their titles stay
   * hidden */
  hiddenSources: Atom<number>
  /** Every removed translation is published and can be archived instead */
  archivable: Atom<boolean>
  /** The public URLs of the removed translations of pages */
  urls: Atom<Array<RemovedUrl>>
  /** The page the editor picked to redirect the URLs to */
  redirect: PrimitiveAtom<RedirectTarget | undefined>
  /** The URLs the redirect target has no version for, they don't redirect */
  unredirected: Atom<Array<RemovedUrl>>
}

export interface RemovePlanOptions {
  subjects: Array<RemoveSubject>
  locales?: Array<string>
  references?: Array<EntryReferenceWithSource>
  /** Links from versions the user can not read */
  hidden?: Array<EntryReference>
  descendants?: Array<RemovedDescendant>
  /** The translations that can be archived */
  archivable?: Array<Removal>
  /** The public URLs of the subjects, in each of their languages */
  urls?: Array<RemovedUrl>
}

/**
 * Entries without languages are removed entirely, the others in the picked
 * languages or, in a batch, the language they are shown in.
 */
export function createRemovePlan({
  subjects,
  locales,
  references = [],
  hidden = [],
  descendants = [],
  archivable = [],
  urls = []
}: RemovePlanOptions): RemovePlan {
  const shown = subjects[0]?.locale
  const selectedLocales = atom(
    shown && locales?.includes(shown) ? [shown] : Array<string>()
  )
  const removals = atom(get => {
    const selected = get(selectedLocales)
    return subjects.flatMap(({id, locale}): Array<Removal> => {
      if (locale === null || !locales) return [{id, locale}]
      return selected.map(locale => ({id, locale}))
    })
  })
  const removed = atom(get =>
    get(removals).flatMap(removal => [
      removal,
      ...descendants.filter(
        ({subjectId, locale}) =>
          subjectId === removal.id && locale === removal.locale
      )
    ])
  )
  // Links from versions that are removed themselves do not break
  const breaks = (reference: EntryReference, removed: Array<Removal>) =>
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
  const removedUrls = atom(get =>
    get(removals).flatMap(({id, locale}) =>
      urls.filter(url => url.id === id && url.locale === locale)
    )
  )
  const redirect = atom<RedirectTarget | undefined>(undefined)
  return {
    subjects,
    locales,
    selectedLocales,
    removals,
    references: atom(get => {
      const current = get(removed)
      return references.filter(({reference}) => breaks(reference, current))
    }),
    hiddenSources: atom(get => {
      const current = get(removed)
      const sources = hidden
        .filter(reference => breaks(reference, current))
        .map(reference => reference.sourceId)
      return new Set(sources).size
    }),
    archivable: atom(get => {
      const current = get(removals)
      return (
        current.length > 0 &&
        current.every(({id, locale}) =>
          archivable.some(item => item.id === id && item.locale === locale)
        )
      )
    }),
    urls: removedUrls,
    redirect,
    unredirected: atom(get => {
      const target = get(redirect)
      if (!target) return []
      return get(removedUrls).filter(
        url => redirectLocale(target.locales, url.locale) === undefined
      )
    })
  }
}

/**
 * The language of the target version a URL of a removed version redirects
 * to: the same language, or the version of a target without languages
 */
function redirectLocale(
  locales: Array<string | null>,
  locale: string | null
): string | null | undefined {
  if (locales.includes(locale)) return locale
  if (locales.includes(null)) return null
  return undefined
}

/** Pages have a public URL and keep the URLs that redirect to them */
function hasUrl(type: Type | undefined): boolean {
  if (!type || type === MediaFile || type === MediaLibrary) return false
  return hasUrlAliases(type)
}

/** The versions of a redirect target that hold its aliases */
const redirectStatuses = ['published', 'draft'] as const

export interface RedirectPicker {
  /** The entries of the types that hold URL aliases */
  condition: Filter<EntryFields>
  /** The roots of the workspace of the removed entries */
  locations: Array<ExplorerLimitLocation>
  /** Entries that are not removed and the user may add an alias to */
  canSelect(item: ExplorerItemData): boolean
}

/** Which pages the URLs of the removed entries can redirect to */
export function redirectPicker(
  config: Config,
  policy: Policy,
  subjects: Array<RemoveSubject>
): RedirectPicker {
  const [first] = subjects
  const removed = new Set(subjects.map(subject => subject.id))
  const types = entries(config.schema)
    .filter(([, type]) => hasUrl(type))
    .map(([name]) => name)
  const workspace = first && config.workspaces[first.workspace]
  const roots = workspace ? entries(getWorkspace(workspace).roots) : []
  const locations = roots
    .filter(([, root]) => !Root.isMediaRoot(root))
    .map(([root]) => ({workspace: first.workspace, root}))
  return {
    condition: {_type: {in: types}},
    locations,
    canSelect(item) {
      if (removed.has(item.id)) return false
      if (item.parents.some(parent => removed.has(parent))) return false
      // The aliases of a published version are published with it
      return (
        policy.canUpdate({...item, field: 'metadata.aliases'}) &&
        policy.canPublish(item)
      )
    }
  }
}

/** Loads the page the editor picked to redirect the URLs to */
export const loadRedirectTargetAtom = atom(
  null,
  async (
    get,
    _set,
    id: string,
    locale: string | null
  ): Promise<RedirectTarget | undefined> => {
    const versions = await get(graphAtom).find({
      id,
      status: 'all',
      versionStatus: {in: redirectStatuses},
      select: {title: Entry.title, locale: Entry.locale, url: Entry.url}
    })
    const shown =
      versions.find(version => version.locale === locale) ?? versions[0]
    if (!shown) return undefined
    const locales = new Set(versions.map(version => version.locale))
    return {id, title: shown.title, url: shown.url, locales: [...locales]}
  }
)

/** Loads the references to the entries before the remove dialog opens */
export const loadRemovePlanAtom = atom(
  null,
  async (
    get,
    _set,
    subjects: Array<RemoveSubject>,
    locales?: Array<string>
  ): Promise<RemovePlan> => {
    const config = get(configAtom)
    const policy = get(policyAtom)
    const [first] = subjects
    const versions = await get(graphAtom).find({
      id: {in: subjects.map(subject => subject.id)},
      status: 'all',
      select: {
        id: Entry.id,
        locale: Entry.locale,
        status: Entry.status,
        active: Entry.active,
        url: Entry.url,
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
    const subjectOf = (id: string) =>
      subjects.find(subject => subject.id === id)
    // Like the Archive action of the entry menu: published entries without a
    // draft, files are deleted rather than archived
    const archivable = versions.flatMap(({id, locale, status, active}) => {
      const subject = subjectOf(id)
      if (!subject || !active || status !== 'published') return []
      if (config.schema[subject.type] === MediaFile) return []
      if (!policy.canArchive({...subject, locale})) return []
      return [{id, locale}]
    })
    // Only a published page was public, a draft has the url of its main
    // version
    const urls = versions.flatMap(({id, locale, status, url}) => {
      const subject = subjectOf(id)
      if (!subject || status !== 'published' || !url) return []
      if (!hasUrl(config.schema[subject.type])) return []
      return [{id, locale, url}]
    })
    const targetIds = new Set(
      subjects.map(subject => subject.id).concat(descendants.map(d => d.id))
    )
    const {references, hidden} = await loadIncomingReferences(
      get,
      Array.from(targetIds)
    )
    return createRemovePlan({
      subjects,
      locales: locales?.filter(locale => policy.canDelete({...first, locale})),
      references,
      hidden,
      descendants,
      archivable,
      urls: urls.filter(
        (url, index) =>
          urls.findIndex(
            other => other.id === url.id && other.locale === url.locale
          ) === index
      )
    })
  }
)

/**
 * The updates that add the removed URLs to the aliases of the redirect
 * target, in the language they were removed in
 */
async function redirects(
  get: Getter,
  plan: RemovePlan
): Promise<Array<Mutation>> {
  const target = get(plan.redirect)
  const urls = get(plan.urls)
  if (!target || urls.length === 0) return []
  const versions = await get(graphAtom).find({
    id: target.id,
    status: 'all',
    versionStatus: {in: redirectStatuses},
    select: {
      locale: Entry.locale,
      status: Entry.versionStatus,
      data: Entry.data
    }
  })
  const locales = versions.map(version => version.locale)
  return versions.flatMap(({locale, status, data}): Array<Mutation> => {
    const redirected = urls
      .filter(url => redirectLocale(locales, url.locale) === locale)
      .map(url => url.url)
    const next = dataWithUrlAliases(data, redirected)
    if (next === data) return []
    const set = {metadata: next.metadata}
    return [{op: 'update', id: target.id, locale, status, set}]
  })
}

/** Removes the translations and redirects their URLs in one commit */
export const deleteEntriesAtom = atom(
  null,
  async (get, _set, plan: RemovePlan) => {
    const removals = get(plan.removals).map(
      (removal): Mutation => ({op: 'remove', ...removal})
    )
    const updates = await redirects(get, plan)
    await get(graphAtom).mutate(removals.concat(updates))
  }
)

/** Archives the translations the plan would delete */
export const archiveEntriesAtom = atom(
  null,
  async (get, _set, plan: RemovePlan) => {
    const removals = get(plan.removals).map(
      (removal): Mutation => ({op: 'archive', ...removal})
    )
    const updates = await redirects(get, plan)
    await get(graphAtom).mutate(removals.concat(updates))
  }
)

// The browser can block its storage, which throws, then the choice lasts
// until the dashboard reloads
const noStorage = {getItem: () => null, setItem() {}, removeItem() {}}

function session() {
  try {
    return globalThis.sessionStorage ?? noStorage
  } catch {
    return noStorage
  }
}

/** Archive without asking first, until the browser session ends */
export const archiveDirectlyAtom = atomWithStorage(
  'alinea-dashboard-archive-directly',
  false,
  createJSONStorage<boolean>(session),
  {getOnInit: true}
)
