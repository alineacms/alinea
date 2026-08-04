import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Entry as EntryRecord} from '#/core/Entry.js'
import type {Field} from '#/core/Field.js'
import type {PreviewMetadata} from '#/core/Preview.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import type {WorkspaceInternal} from '#/core/Workspace.js'
import {Type} from '#/index.js'
import {atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import type {Dispatch, PropsWithChildren, SetStateAction} from 'react'
import {createContext, createElement, useContext, useMemo} from 'react'
import {graphAtom} from './atoms/core.js'
import {type EditorModel, type EditorNode, EntryEditor} from './atoms/editor.js'
import type {EntryAtoms, EntryLocaleAtoms} from './atoms/entry.js'
import type {Page} from './atoms/nav.js'
import type {RootAtoms} from './atoms/root.js'
import {policyAtom, userAtom} from './atoms/user.js'
import type {ReactiveNode} from './atoms/ReactiveNode.js'
import {previewMetadataAtom} from './atoms/preview.js'

interface EntryContextValue {
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
}

export interface DashboardContextValue {
  page: Page
  workspace: WorkspaceInternal & {name: string}
  root: RootAtoms
}

const entryContext = createContext<EntryContextValue | null>(null)
const dashboardContext = createContext<DashboardContextValue | null>(null)
const editorContext = createContext<EditorModel | null>(null)
const nullEntryAtom = atom<EntryRecord<Record<string, unknown>> | null>(null)
/**
 * Returns the active dashboard policy.
 */
export function usePolicy() {
  return useAtomValue(policyAtom)
}

/**
 * Returns the authenticated dashboard user, or null when no user is active.
 */
export function useUser(): User | null {
  return useAtomValue(userAtom) ?? null
}

/**
 * Returns the dashboard graph database for direct read queries.
 */
export function useGraph(): WriteableGraph {
  return useAtomValue(graphAtom)
}

/**
 * Returns metadata reported by the active browser preview, when available.
 */
export function usePreviewMetadata(): PreviewMetadata | undefined {
  return useAtomValue(previewMetadataAtom)
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
}

export function EntryScope({
  children,
  entry,
  localeData
}: PropsWithChildren<EntryScopeProps>) {
  const value = useMemo(() => ({entry, localeData}), [entry, localeData])
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
export function useNodeEditor(node: EditorNode, type: Type) {
  const parent = useContext(editorContext)
  const scope = useContext(entryContext)
  const activeVersionAtom = scope?.localeData.selectedEntry ?? nullEntryAtom
  const activeVersion = useAtomValue(activeVersionAtom)
  const editor = useMemo(() => {
    return new EntryEditor(
      type,
      node,
      parent instanceof EntryEditor ? parent : undefined,
      activeVersion ?? undefined
    )
  }, [activeVersion, node, parent, type])
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
  const scope = useEntryModel()
  const selectedEntryAtom = scope?.localeData.selectedEntry ?? nullEntryAtom
  return useAtomValue(selectedEntryAtom)
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
