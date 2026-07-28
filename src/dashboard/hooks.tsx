import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Entry as EntryRecord} from '#/core/Entry.js'
import type {EntryAnchorTarget, Field} from '#/core/Field.js'
import type {Type} from '#/core/Type.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {
  atom,
  createStore,
  Provider,
  useAtom,
  useAtomValue,
  useSetAtom
} from 'jotai'
import {useHydrateAtoms} from 'jotai/utils'
import type {Dispatch, PropsWithChildren, SetStateAction} from 'react'
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState
} from 'react'
import type {
  Dashboard,
  DashboardEntryData,
  ReactiveNode
} from './atoms/Dashboard.js'
import {
  clientAtom,
  configAtom,
  createDashboardNavigation,
  createEditor,
  dashboardEffectsAtom,
  dashboardAtoms,
  eventsAtom,
  graphAtom,
  navigationAtom,
  optionsAtom,
  previewTokenRequestsAtom,
  viewsAtom,
  type DashboardInput,
  type Editor
} from './atoms/Dashboard.js'
import {createBrowserHistory} from './atoms/navigation/History.js'

const entryContext = createContext<DashboardEntryData | null>(null)
const editorContext = createContext<Editor | null>(null)
const nullEntryAtom = atom<EntryRecord<Record<string, unknown>> | null>(null)

export function DashboardScopeInternal({
  children,
  dashboard
}: PropsWithChildren<{dashboard: Dashboard}>) {
  const [store] = useState(createStore)
  return createElement(
    Provider,
    {store},
    createElement(DashboardHydration, {dashboard}, children)
  )
}

function DashboardHydration({
  children,
  dashboard
}: PropsWithChildren<{dashboard: Dashboard}>) {
  const {input} = dashboard
  assert(input, 'Dashboard input not found')
  useHydrateDashboard(input)
  return children
}

export function useHydrateDashboard(input: DashboardInput) {
  const navigation = useMemo(
    () =>
      createDashboardNavigation(
        input.options.history ?? createBrowserHistory()
      ),
    [input.options.history]
  )
  const previewTokenRequests = useMemo(
    () => new Map<string, Promise<string>>(),
    []
  )
  useHydrateAtoms([
    [graphAtom, input.graph],
    [configAtom, input.config],
    [eventsAtom, input.events],
    [clientAtom, input.client],
    [viewsAtom, input.views],
    [optionsAtom, input.options],
    [navigationAtom, navigation],
    [previewTokenRequestsAtom, previewTokenRequests]
  ] as const)
  useAtomValue(dashboardEffectsAtom)
}

/**
 * Returns the active dashboard model from the nearest dashboard scope.
 */
export function useDashboard() {
  return dashboardAtoms
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
  editor: Editor
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
 * Returns all anchors in the entry currently being edited.
 */
export function useEntryAnchors(): Array<EntryAnchorTarget> {
  let editor = useEditor()
  while (editor.parent) editor = editor.parent
  return useAtomValue(editor.anchors)
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
  const parent = useContext(editorContext)
  const entry = useContext(entryContext)
  const activeVersionAtom = useMemo(() => {
    return entry?.activeVersion ?? atom(null)
  }, [entry])
  const activeVersion = useAtomValue(activeVersionAtom)
  const editor = useMemo(
    () =>
      createEditor(
        type,
        node,
        parent ?? undefined,
        activeVersion ?? undefined
      ),
    [activeVersion, node, parent, type]
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
  assert(nodes[key], `Node not found for field key: ${key}`)
  return nodes[key] as ReactiveNode<Value>
}

/**
 * Returns the current stored value for a field.
 */
export function useFieldValue<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): StoredValue {
  const node = useFieldNode<StoredValue>(field)
  return useAtomValue(node.value)
}

/**
 * Returns the current stored field value and a setter for that value.
 */
export function useField<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): [StoredValue, Dispatch<SetStateAction<StoredValue>>] {
  const info = useFieldInfo(field)
  const node = useFieldNode<StoredValue>(field)
  const value = useAtomValue(node.value)
  const setNodeValue = useSetAtom(node.value)
  const setFieldValue = useSetAtom(info.value)
  function setValue(update: SetStateAction<StoredValue>) {
    setFieldValue(update)
    setNodeValue(update)
  }
  return [value, setValue]
}

/**
 * Returns a setter for the current stored field value.
 */
export function useFieldSetter<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): Dispatch<SetStateAction<StoredValue>> {
  const info = useFieldInfo(field)
  const node = useFieldNode<StoredValue>(field)
  const setNodeValue = useSetAtom(node.value)
  const setFieldValue = useSetAtom(info.value)
  return function setValue(update: SetStateAction<StoredValue>) {
    setFieldValue(update)
    setNodeValue(update)
  }
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
