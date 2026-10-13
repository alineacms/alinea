/**
 * The hooks of custom field and dashboard views, exported from `alinea/cms`.
 * Their types do not expose the internal state of the dashboard.
 */
import type {DashboardEntry} from '#/core/DashboardEntry.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Entry} from '#/core/Entry.js'
import type {Field} from '#/core/Field.js'
import type {EntryDefaultView} from '#/core/Type.js'
import type {PreviewMetadata} from '#/core/Preview.js'
import type {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext,
  useMemo
} from 'react'
import {graphAtom} from '../atoms/core.js'
import {
  hashFromRoute,
  type ResolvedDashboardRoute,
  routeAtom
} from '../atoms/nav.js'
import {previewMetadataAtom} from '../atoms/preview.js'
import {policyAtom, userAtom} from '../atoms/user.js'
import {
  dashboardContext,
  entryContext,
  useEditor,
  useFieldInfo
} from '../contexts.js'

/**
 * Returns the permissions of the signed-in user. Check access with
 * `policy.get({workspace, root, id, ...})`, which returns flags such as
 * `read`, `update` and `publish`.
 */
export function usePolicy(): Policy {
  return useAtomValueRaw(policyAtom)
}

/**
 * Returns the authenticated dashboard user, or null when no user is active.
 */
export function useUser(): User | null {
  return useAtomValueRaw(userAtom)
}

/**
 * Returns the dashboard's content graph. Query it with the same API as the
 * `cms` instance, for example `graph.find({type: Article})`. Changes made
 * through it are committed with the permissions of the signed-in user.
 */
export function useGraph(): WriteableGraph {
  return useAtomValueRaw(graphAtom)
}

/**
 * Returns metadata reported by the active browser preview, when available.
 */
export function usePreviewMetadata(): PreviewMetadata | undefined {
  return useAtomValueRaw(previewMetadataAtom)
}

/**
 * Returns the stored value of a field in the entry, list row or object being
 * edited. Use it in a view that only reads the value.
 *
 * The field-based hooks (`useFieldValue`, `useField`, `useFieldSetter`, ...)
 * also read the fields around a custom field: pass a field of the same row,
 * of a parent row or of the entry, and it resolves in the nearest scope that
 * holds it. Import the type from your schema or pass the field through the
 * options of your field.
 *
 * @example
 * // In the view of a field inside a list row of `BlogPost`
 * const title = useFieldValue(BlogPost.title) // a field of the entry
 * const price = useFieldValue(options.price) // a field passed as option
 */
export function useFieldValue<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): StoredValue {
  const info = useFieldInfo(field)
  return useAtomValueRaw(info.value) as StoredValue
}

/**
 * Returns the stored value of a field and a setter, like `useState`. The
 * setter also accepts an updater function that receives the current value.
 *
 * @example
 * const [value, setValue] = useField(field)
 */
export function useField<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): [StoredValue, Dispatch<SetStateAction<StoredValue>>] {
  const info = useFieldInfo(field)
  const value = useAtomValueRaw(info.value) as StoredValue
  const setValue = useSetAtom(info.value) as Dispatch<
    SetStateAction<StoredValue>
  >
  return [value, setValue]
}

/**
 * Returns only the setter of a field's stored value, so the component does
 * not re-render when the value changes.
 */
export function useFieldSetter<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): Dispatch<SetStateAction<StoredValue>> {
  const info = useFieldInfo(field)
  return useSetAtom(info.value) as Dispatch<SetStateAction<StoredValue>>
}

/**
 * Returns the key a field is stored under in the entry, list row or object
 * being edited, for example `'title'`.
 */
export function useFieldKey<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): string {
  const info = useFieldInfo(field)
  return info.key
}

/**
 * Returns the options of a field with the dashboard state applied: `readOnly`
 * is also `true` when the user may not edit the field or the entry, and
 * `hidden` reflects the user's permissions. Includes the field's `label`.
 */
export function useFieldOptions<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useFieldInfo(field)
  return useAtomValueRaw(info.options) as Options
}

/**
 * Returns the validation message of a field (from `required` or `validate`),
 * or `undefined` while the value is valid.
 */
export function useFieldError<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): string | undefined {
  const info = useFieldInfo(field)
  return useAtomValueRaw(info.error)
}

/**
 * Returns the stored value of another field in the same entry, list row or
 * object, by its key.
 *
 * @deprecated Pass the field to `useFieldValue` instead, which is typed and
 * also reads fields of a parent row or the entry:
 * `useFieldValue(BlogPost.title)`.
 */
export function useSiblingFieldValue(key: string): unknown {
  const editor = useEditor()
  const info = editor.field(key)
  assert(info, `Field not found: ${key}`)
  return useAtomValueRaw(info.value)
}

/**
 * Returns the entry being edited, in the selected locale and version.
 * `entry.data` holds the field values as saved: use `useFieldValue(field)`
 * for the live value while the editor changes it.
 *
 * Returns null outside an entry, eg. in a root view.
 */
export function useEntry(): DashboardEntry | null {
  const selected = useContext(entryContext)?.selectedEntry
  return useMemo(() => (selected ? dashboardEntry(selected) : null), [selected])
}

/** @internal */
export function dashboardEntry(entry: Entry): DashboardEntry {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    path: entry.path,
    url: entry.url,
    locale: entry.locale,
    status: entry.status,
    workspace: entry.workspace,
    root: entry.root,
    parentId: entry.parentId,
    data: entry.data
  }
}

/**
 * Returns the current locale of the dashboard: the locale of the entry being
 * edited, or the selected locale of the current root. `null` for content
 * without translations or outside the dashboard layout.
 */
export function useLocale(): string | null {
  const entry = useContext(entryContext)
  const dashboard = useContext(dashboardContext)
  // An untranslated entry shows its translation source in another locale
  if (entry) return entry.localeData.requestedLocale
  return dashboard?.page.locale ?? null
}

/** A place in the dashboard to navigate to */
export interface DashboardLocation {
  /** Name of the workspace, leave out with `root` to open an entry by id */
  workspace?: string
  /** Name of the root, leave out with `workspace` to open an entry by id */
  root?: string
  /** Id of the entry to open, leave out to open the root */
  entryId?: string
  /** Locale to open, for roots with translations */
  locale?: string | null
  /**
   * Open the entry's form (`edit`) or the list of its children (`overview`),
   * for entries with both
   */
  view?: EntryDefaultView
}

function dashboardRoute(location: DashboardLocation): ResolvedDashboardRoute {
  const locale = location.locale ?? undefined
  // Without workspace and root, the edit page looks up the entry by id
  if (location.entryId && !location.workspace && !location.root)
    return {page: 'edit', entry: location.entryId, locale, view: location.view}
  return {
    page: 'entry',
    workspace: location.workspace,
    root: location.root,
    entry: location.entryId,
    locale,
    view: location.view
  }
}

/**
 * Returns a function that navigates the dashboard to an entry or root. The
 * user is asked to confirm first when the current entry has unsaved changes.
 * An entry can be opened by its id alone, its workspace and root are looked
 * up.
 *
 * @example
 * const navigate = useNavigate()
 * navigate({entryId: post.id, locale: 'en'})
 * navigate({workspace: 'main', root: 'pages'})
 */
export function useNavigate(): (location: DashboardLocation) => void {
  const setRoute = useSetAtom(routeAtom)
  return useCallback(
    (location: DashboardLocation) => setRoute(dashboardRoute(location)),
    [setRoute]
  )
}

/**
 * Returns the href of a place in the dashboard, for a link that also opens
 * in a new tab. An entry can be linked by its id alone.
 *
 * @example
 * <a href={useHref({entryId: post.id})}>{post.title}</a>
 */
export function useHref(location: DashboardLocation): string {
  const {workspace, root, entryId, locale, view} = location
  return useMemo(
    () =>
      hashFromRoute(dashboardRoute({workspace, root, entryId, locale, view})),
    [workspace, root, entryId, locale, view]
  )
}
