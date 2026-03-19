import {WriteableGraph} from 'alinea/core/db/WriteableGraph.js'
import type {Field} from 'alinea/core/Field'
import {assert} from 'alinea/core/util/Assert.js'
import {useAtom, useAtomValue} from 'jotai'
import type {PropsWithChildren} from 'react'
import {createContext, createElement, useContext} from 'react'
import type {DashboardEntry, Node} from './Dashboard.js'
import {ArrayNode, DashboardEditor, ObjectNode} from './Dashboard.js'

const entryContext = createContext<DashboardEntry | null>(null)
const editorContext = createContext<DashboardEditor | null>(null)

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
  entry: DashboardEntry
}

export function EntryScope({
  children,
  entry
}: PropsWithChildren<EntryScopeProps>) {
  return createElement(entryContext.Provider, {value: entry}, children)
}

function useDashboardEditor() {
  const editor = useContext(editorContext)
  assert(editor, 'DashboardEditor not found in context')
  return editor
}

export function useField<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): [QueryValue, Mutator] {
  const editor = useDashboardEditor()
  const info = editor.get(field)
  assert(info, 'Field info not found in editor')
  return useAtom(info.value)
}

export function useFieldKey<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): string {
  const editor = useDashboardEditor()
  const info = editor.get(field)
  assert(info, 'Field info not found in editor')
  return info.key
}

export function useFieldOptions<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const editor = useDashboardEditor()
  const info = editor.get(field)
  assert(info, 'Field info not found in editor')
  return useAtomValue(info.options) as Options
}

export function useFieldError<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const editor = useDashboardEditor()
  const info = editor.get(field)
  assert(info, 'Field info not found in editor')
  return useAtomValue(info.error)
}

export function useFieldView<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const editor = useDashboardEditor()
  const info = editor.get(field)
  assert(info, 'Field info not found in editor')
  return useAtomValue(info.view)
}

export function useSiblingFieldValue(key: string) {
  const editor = useDashboardEditor()
  const info = editor.field[key]
  assert(info, `Field not found: ${key}`)
  return useAtomValue(info.value)
}

export function useGraph() {
  const editor = useDashboardEditor()
  return useAtomValue(editor.dashboard.db) as WriteableGraph
}

export function useEntry() {
  return useContext(entryContext)
}

export function useValue<Value>(node: Node<Value>) {
  return useAtom(node.value)
}

export function useNodes<Value>(node: Node<Array<Value>>): Array<Node<Value>>
export function useNodes<Value extends object>(
  node: Node<Value>
): Record<string, Node>
export function useNodes(node: Node<any>) {
  if (node instanceof ArrayNode) return useAtomValue(node.nodes)
  if (node instanceof ObjectNode) return useAtomValue(node.nodes)
  throw new Error('Only object and array fields have nodes')
}
