import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Entry as EntryRecord} from '#/core/Entry.js'
import type {Field} from '#/core/Field.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {Type} from '#/index.js'
import {atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import {useHydrateAtoms} from 'jotai/utils'
import type {
  Dispatch,
  PropsWithChildren,
  SetStateAction
} from 'react'
import {createContext, createElement, useContext, useMemo} from 'react'
import type {Dashboard, DashboardEntryData, ReactiveNode} from './Dashboard.js'
import {dashboardAtom, DashboardEditor} from './Dashboard.js'

const entryContext = createContext<DashboardEntryData | null>(null)
const editorContext = createContext<DashboardEditor | null>(null)
const nullEntryAtom = atom<EntryRecord<Record<string, unknown>> | null>(null)

export function DashboardScopeInternal({
  children,
  dashboard
}: PropsWithChildren<{dashboard: Dashboard}>) {
  useHydrateAtoms([[dashboardAtom, dashboard]])
  return children
}

/**
 * Returns the active dashboard model from the nearest dashboard scope.
 */
export function useDashboard() {
  return useAtomValue(dashboardAtom)
}

/**
 * Returns the active dashboard policy.
 */
export function usePolicy() {
  const dashboard = useDashboard()
  return useAtomValue(dashboard.policy)
}

/**
 * Returns the authenticated dashboard user, or null when no user is active.
 */
export function useUser(): User | null {
  const dashboard = useDashboard()
  return useAtomValue(dashboard.user) ?? null
}

/**
 * Returns the dashboard graph database for direct read queries.
 */
export function useGraph(): WriteableGraph {
  const dashboard = useDashboard()
  return useAtomValue(dashboard.db)
}

export interface EditorScopeProps {
  editor: DashboardEditor
}

export function EditorScope({
  children,
  editor
}: PropsWithChildren<EditorScopeProps>) {
  return createElement(editorContext.Provider, {value: editor}, children)
}

export interface EntryScopeProps {
  entry: DashboardEntryData
}

export function EntryScope({
  children,
  entry
}: PropsWithChildren<EntryScopeProps>) {
  return createElement(entryContext.Provider, {value: entry}, children)
}

/**
 * Returns the active dashboard editor from the nearest editor scope.
 */
export function useEditor() {
  const editor = useContext(editorContext)
  assert(editor, 'DashboardEditor not found in context')
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
export function useNodeEditor(node: ReactiveNode<object>, type: Type) {
  const dashboard = useDashboard()
  const parent = useContext(editorContext)
  const entry = useContext(entryContext)
  const activeVersionAtom = useMemo(() => {
    return entry?.activeVersion ?? atom(null)
  }, [entry])
  const activeVersion = useAtomValue(activeVersionAtom)
  const editor = useMemo(
    () =>
      new DashboardEditor(
        dashboard,
        type,
        node,
        parent ?? undefined,
        activeVersion ?? undefined
      ),
    [activeVersion, dashboard, node, parent, type]
  )
  return editor
}

/**
 * Returns the reactive node backing a field in the active editor.
 */
export function useFieldNode<Value>(field: Field): ReactiveNode<Value> {
  const key = useFieldKey(field)
  const editor = useEditor()
  const nodes = useAtomValue(editor.node.nodes) as Record<string, ReactiveNode>
  if (!nodes[key]) console.trace(editor.node)
  assert(nodes[key], `Node not found for field key: ${key}`)
  return nodes[key] as ReactiveNode<Value>
}

/**
 * Returns the current stored value for a field.
 */
export function useFieldValue<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): StoredValue {
  const info = useFieldInfo(field)
  return useAtomValue(info.value) as StoredValue
}

/**
 * Returns the current stored field value and a setter for that value.
 */
export function useField<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): [StoredValue, Dispatch<SetStateAction<StoredValue>>] {
  const info = useFieldInfo(field)
  // Todo: "mutator" will not really be relevant anymore
  return useAtom(info.value) as [
    StoredValue,
    Dispatch<SetStateAction<StoredValue>>
  ]
}

/**
 * Returns a setter for the current stored field value.
 */
export function useFieldSetter<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): Dispatch<SetStateAction<StoredValue>> {
  const info = useFieldInfo(field)
  return useSetAtom(info.value) as Dispatch<SetStateAction<StoredValue>>
}

/**
 * Returns the dashboard storage key for a field.
 */
export function useFieldKey<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): string {
  const info = useFieldInfo(field)
  return info.key
}

/**
 * Returns the resolved dashboard options for a field.
 */
export function useFieldOptions<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useFieldInfo(field)
  return useAtomValue(info.options) as Options
}

/**
 * Returns the current validation error for a field, if any.
 */
export function useFieldError<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): string | undefined {
  const info = useFieldInfo(field)
  return useAtomValue(info.error)
}

/**
 * Returns the configured dashboard view component for a field.
 */
export function useFieldView<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useFieldInfo(field)
  return useAtomValue(info.view)
}

/**
 * Returns the current value for a sibling field by storage key.
 */
export function useSiblingFieldValue(key: string) {
  const editor = useEditor()
  const info = editor.field(key)
  assert(info, `Field not found: ${key}`)
  return useAtomValue(info.value)
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
  const entry = useEntryModel()
  return useAtomValue(entry?.currentEntry ?? nullEntryAtom)
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
export function useNodes(node: ReactiveNode<any>) {
  return useAtomValue(node.nodes)
}
