import {Type} from 'alinea'
import {WriteableGraph} from 'alinea/core/db/WriteableGraph.js'
import type {Field} from 'alinea/core/Field'
import {assert} from 'alinea/core/util/Assert.js'
import {useAtom, useAtomValue} from 'jotai'
import type {PropsWithChildren} from 'react'
import {createContext, createElement, useContext, useMemo} from 'react'
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

function useEditor() {
  const editor = useContext(editorContext)
  assert(editor, 'DashboardEditor not found in context')
  return editor
}

function useField(field: Field) {
  const editor = useEditor()
  const info = editor.get(field)
  assert(info, 'Field info not found in editor')
  return info
}

export function useNodeEditor(node: Node, type: Type) {
  const parent = useEditor()
  assert(node instanceof ObjectNode, 'Expected object node')
  const editor = useMemo(
    () => new DashboardEditor(parent.dashboard, type, node),
    [parent.dashboard, node, type]
  )
  return editor
}

export function useFieldNode(field: Field) {
  const key = useFieldKey(field)
  const editor = useEditor()
  const nodes = useAtomValue(editor.node.nodes)
  return nodes[key]
}

export function useFieldValue<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): [StoredValue, Mutator] {
  const info = useField(field)
  // Todo: "mutator" will not really be relevant anymore
  return useAtom(info.value) as [StoredValue, Mutator]
}

export function useFieldKey<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): string {
  const info = useField(field)
  return info.key
}

export function useFieldOptions<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useField(field)
  return useAtomValue(info.options) as Options
}

export function useFieldError<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): string | undefined {
  const info = useField(field)
  return useAtomValue(info.error)
}

export function useFieldView<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useField(field)
  return useAtomValue(info.view)
}

export function useSiblingFieldValue(key: string) {
  const editor = useEditor()
  const info = editor.field[key]
  assert(info, `Field not found: ${key}`)
  return useAtomValue(info.value)
}

export function useGraph() {
  const editor = useEditor()
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
