import {Type} from '#/index.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Field} from '#/core/Field.js'
import {assert} from '#/core/util/Assert.js'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import type {Dispatch, PropsWithChildren, SetStateAction} from 'react'
import {createContext, createElement, useContext, useMemo} from 'react'
import type {Dashboard, DashboardEntry, ReactiveNode} from './Dashboard.js'
import {DashboardEditor} from './Dashboard.js'

const dashboardContext = createContext<Dashboard | null>(null)
const entryContext = createContext<DashboardEntry | null>(null)
const editorContext = createContext<DashboardEditor | null>(null)

export function DashboardScopeInternal({
  children,
  dashboard
}: PropsWithChildren<{dashboard: Dashboard}>) {
  return createElement(dashboardContext.Provider, {value: dashboard}, children)
}

export function useDashboard() {
  const dashboard = useContext(dashboardContext)
  assert(dashboard, 'Dashboard not found in context')
  return dashboard
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

export function useNodeEditor(node: ReactiveNode<object>, type: Type) {
  const dashboard = useDashboard()
  const editor = useMemo(
    () => new DashboardEditor(dashboard, type, node),
    [dashboard, node, type]
  )
  return editor
}

export function useFieldNode<Value>(field: Field): ReactiveNode<Value> {
  const key = useFieldKey(field)
  const editor = useEditor()
  const nodes = useAtomValue(editor.node.nodes) as Record<string, ReactiveNode>
  if (!nodes[key]) console.trace(editor.node)
  assert(nodes[key], `Node not found for field key: ${key}`)
  return nodes[key] as ReactiveNode<Value>
}

export function useFieldValue<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): [StoredValue, Dispatch<SetStateAction<StoredValue>>] {
  const info = useField(field)
  // Todo: "mutator" will not really be relevant anymore
  return useAtom(info.value) as [
    StoredValue,
    Dispatch<SetStateAction<StoredValue>>
  ]
}

export function useFieldSetter<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): Dispatch<SetStateAction<StoredValue>> {
  const info = useField(field)
  return useSetAtom(info.value) as Dispatch<SetStateAction<StoredValue>>
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
  const info = editor.field(key)
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

export function useValue<Value>(node: ReactiveNode<Value>) {
  return useAtom(node.value)
}

export function useNodes<Value>(
  node: ReactiveNode<Array<Value>>
): Array<ReactiveNode<Value>>
export function useNodes<Value extends object>(
  node: ReactiveNode<Value>
): Record<string, ReactiveNode>
export function useNodes(node: ReactiveNode<any>) {
  return useAtomValue(node.nodes)
}
