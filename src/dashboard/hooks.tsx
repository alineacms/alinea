/**
 * Internal dashboard hooks and scopes.
 *
 * Custom field and dashboard views should import the public hooks from
 * `alinea/cms` instead. Importing `alinea/dashboard/hooks` directly is
 * deprecated: this module also exposes dashboard internals (atoms, reactive
 * nodes, editor models) that change without notice.
 *
 * @internal
 */
import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Entry as EntryRecord} from '#/core/Entry.js'
import type {Field} from '#/core/Field.js'
import type {PreviewMetadata} from '#/core/Preview.js'
import type {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import type {WorkspaceInternal} from '#/core/Workspace.js'
import {Type} from '#/index.js'
import {
  atom,
  createStore,
  Provider,
  useAtom,
  useAtomValueRaw,
  useSetAtom
} from 'jotai'
import type {
  ComponentType,
  Dispatch,
  PropsWithChildren,
  SetStateAction
} from 'react'
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo
} from 'react'
import {
  alineaDevAtom,
  clientAtom,
  configAtom,
  eventsAtom,
  graphAtom,
  localAtom,
  viewsAtom
} from './atoms/core.js'
import {
  type EditorModel,
  type EditorNode,
  EntryEditor,
  type ResolvedEditorImage
} from './atoms/editor.js'
import type {EntryAtoms, EntryLocaleAtoms} from './atoms/entry.js'
import type {Page} from './atoms/nav.js'
import type {RootAtoms} from './atoms/root.js'
import type {ReactiveNode} from './atoms/ReactiveNode.js'
import {routeAtom} from './atoms/nav.js'
import {previewMetadataAtom} from './atoms/preview.js'
import {policyAtom, userAtom} from './atoms/user.js'

interface EntryContextValue {
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
  richTextImages: ReadonlyMap<string, ResolvedEditorImage>
  selectedEntry: EntryRecord<Record<string, unknown>>
}

export interface DashboardOptions {
  alineaDev?: boolean
  local?: boolean
}

export interface Dashboard {
  graph: WriteableGraph
  config: Config
  events: EventTarget
  client: LocalConnection
  views?: Record<string, ComponentType>
  options?: DashboardOptions
}

export interface DashboardContextValue {
  page: Page
  workspace: WorkspaceInternal & {name: string}
  root: RootAtoms
}

const entryContext = createContext<EntryContextValue | null>(null)
const dashboardContext = createContext<DashboardContextValue | null>(null)
const dashboardModelContext = createContext<Dashboard | null>(null)
const editorContext = createContext<EditorModel | null>(null)
const noPolicyAtom = atom<Policy | undefined>(undefined)

interface DashboardModelScopeProps {
  dashboard: Dashboard
}

export function DashboardModelScope({
  children,
  dashboard
}: PropsWithChildren<DashboardModelScopeProps>) {
  return createElement(
    dashboardModelContext.Provider,
    {value: dashboard},
    children
  )
}

export interface DashboardScopeInternalProps {
  dashboard: Dashboard
}

/**
 * Provides an isolated dashboard model for custom views and story fixtures.
 */
export function DashboardScopeInternal({
  children,
  dashboard
}: PropsWithChildren<DashboardScopeInternalProps>) {
  const store = useMemo(() => {
    const next = createStore()
    next.set(graphAtom, dashboard.graph)
    next.set(configAtom, dashboard.config)
    next.set(eventsAtom, dashboard.events)
    next.set(clientAtom, dashboard.client)
    next.set(viewsAtom, dashboard.views ?? {})
    next.set(localAtom, Boolean(dashboard.options?.local))
    next.set(alineaDevAtom, Boolean(dashboard.options?.alineaDev))
    return next
  }, [dashboard])
  return createElement(
    Provider,
    {store},
    createElement(DashboardModelScope, {dashboard}, children)
  )
}

/**
 * Returns the active dashboard from the nearest dashboard model scope.
 */
export function useDashboard(): Dashboard {
  const dashboard = useContext(dashboardModelContext)
  assert(dashboard, 'Dashboard not found in context')
  return dashboard
}
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

export interface EditorScopeProps {
  editor: EditorModel
}

export function EditorScope({
  children,
  editor
}: PropsWithChildren<EditorScopeProps>) {
  return createElement(editorContext.Provider, {value: editor}, children)
}

export interface DashboardScopeProps {
  value: DashboardContextValue
}

export function DashboardScope({
  children,
  value
}: PropsWithChildren<DashboardScopeProps>) {
  return createElement(dashboardContext.Provider, {value}, children)
}

export function useDashboardContext(): DashboardContextValue {
  const value = useContext(dashboardContext)
  assert(value, 'DashboardScope not found in context')
  return value
}

export interface EntryScopeProps {
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
  richTextImages: ReadonlyMap<string, ResolvedEditorImage>
  selectedEntry: EntryRecord<Record<string, unknown>>
}

export function EntryScope({
  children,
  entry,
  localeData,
  richTextImages,
  selectedEntry
}: PropsWithChildren<EntryScopeProps>) {
  const value = useMemo(
    () => ({entry, localeData, richTextImages, selectedEntry}),
    [entry, localeData, richTextImages, selectedEntry]
  )
  return createElement(entryContext.Provider, {value}, children)
}

export function useEntryAtoms(): EntryContextValue {
  const value = useContext(entryContext)
  assert(value, 'EntryScope not found in context')
  return value
}

export function useOptionalEntryAtoms(): EntryContextValue | null {
  return useContext(entryContext)
}

/**
 * Returns the active dashboard editor from the nearest editor scope.
 */
export function useEditor() {
  const editor = useContext(editorContext)
  assert(editor, 'EntryEditor not found in context')
  return editor
}

/**
 * Returns the editor metadata for a field in the active editor scope.
 */
function useFieldInfo(field: Field) {
  const editor = useEditor()
  const info = editor.get(field)
  assert(info, 'Field info not found in editor')
  return info
}

/**
 * Creates an editor for a nested reactive node.
 */
export function useNodeEditor(
  node: EditorNode,
  type: Type,
  readOnly?: boolean
) {
  const parent = useContext(editorContext)
  const scope = useContext(entryContext)
  const policy = useAtomValueRaw(scope ? policyAtom : noPolicyAtom)
  const activeVersion = scope?.selectedEntry
  const editor = useMemo(() => {
    return new EntryEditor(
      type,
      node,
      parent instanceof EntryEditor ? parent : undefined,
      activeVersion ?? undefined,
      policy,
      scope?.richTextImages,
      readOnly
    )
  }, [
    activeVersion,
    node,
    parent,
    policy,
    readOnly,
    scope?.richTextImages,
    type
  ])
  return editor
}

/**
 * Returns the reactive node backing a field in the active editor.
 */
export function useFieldNode<Value>(field: Field): ReactiveNode<Value> {
  const key = useFieldKey(field)
  const editor = useEditor()
  const nodes = useAtomValueRaw(editor.node.nodes) as Record<
    string,
    ReactiveNode
  >
  assert(nodes[key], `Node not found for field key: ${key}`)
  return nodes[key] as ReactiveNode<Value>
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
 * Returns the configured dashboard view component for a field.
 */
export function useFieldView<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useFieldInfo(field)
  return useAtomValueRaw(info.view)
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
 * Returns the active entry model from the nearest entry scope.
 */
function useEntryModel() {
  return useContext(entryContext)
}

/**
 * Returns the selected entry version as a plain Entry object.
 *
 * Returns null outside an entry scope, or when the current entry cannot be
 * resolved. The returned value follows locale/status selection and does not
 * expose internal atoms.
 */
export function useEntry(): EntryRecord<Record<string, unknown>> | null {
  const scope = useEntryModel()
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
  if (entry) return entry.selectedEntry.locale
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

/**
 * Returns a writable value tuple for a reactive node.
 */
export function useValue<Value>(node: ReactiveNode<Value>) {
  return useAtom(node.value)
}

/**
 * Returns child reactive nodes for an array or object reactive node.
 */
export function useNodes<Value>(
  node: ReactiveNode<Array<Value>>
): Array<ReactiveNode<Value>>
export function useNodes<Value extends object>(
  node: ReactiveNode<Value>
): Record<string, ReactiveNode>
export function useNodes<Value>(node: ReactiveNode<Value>): unknown {
  return useAtomValueRaw(node.nodes)
}
