/**
 * The hooks of custom field and dashboard views, exported from `alinea/cms`.
 * Their types do not expose the internal state of the dashboard.
 */
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Entry as EntryRecord} from '#/core/Entry.js'
import type {Field} from '#/core/Field.js'
import type {PreviewMetadata} from '#/core/Preview.js'
import type {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext
} from 'react'
import {graphAtom} from '../atoms/core.js'
import {routeAtom} from '../atoms/nav.js'
import {previewMetadataAtom} from '../atoms/preview.js'
import {policyAtom, userAtom} from '../atoms/user.js'
import {
  dashboardContext,
  entryContext,
  useEditor,
  useFieldInfo,
  useFieldNode
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
 */
export function useFieldValue<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): StoredValue {
  const node = useFieldNode<StoredValue>(field)
  return useAtomValueRaw(node.value) as StoredValue
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
 */
export function useSiblingFieldValue(key: string) {
  const editor = useEditor()
  const info = editor.field(key)
  assert(info, `Field not found: ${key}`)
  return useAtomValueRaw(info.value)
}

/**
 * Returns the selected entry version as a plain Entry object.
 *
 * Returns null outside an entry scope, or when the current entry cannot be
 * resolved. The returned value follows locale/status selection and does not
 * expose internal atoms.
 */
export function useEntry(): EntryRecord<Record<string, unknown>> | null {
  const scope = useContext(entryContext)
  return scope?.selectedEntry ?? null
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
  /** Name of the workspace */
  workspace: string
  /** Name of the root */
  root: string
  /** Id of the entry to open, leave out to open the root */
  entryId?: string
  /** Locale to open, for roots with translations */
  locale?: string | null
}

/**
 * Returns a function that navigates the dashboard to an entry or root. The
 * user is asked to confirm first when the current entry has unsaved changes.
 *
 * @example
 * const navigate = useNavigate()
 * navigate({workspace: entry.workspace, root: entry.root, entryId: entry.id})
 */
export function useNavigate(): (location: DashboardLocation) => void {
  const setRoute = useSetAtom(routeAtom)
  return useCallback(
    (location: DashboardLocation) =>
      setRoute({
        page: 'entry',
        workspace: location.workspace,
        root: location.root,
        entry: location.entryId,
        locale: location.locale ?? undefined
      }),
    [setRoute]
  )
}
