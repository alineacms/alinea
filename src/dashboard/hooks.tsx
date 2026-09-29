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
import type {Entry as EntryRecord} from '#/core/Entry.js'
import type {Field} from '#/core/Field.js'
import type {Policy} from '#/core/Role.js'
import {assert} from '#/core/util/Assert.js'
import {Type} from '#/index.js'
import {atom, createStore, Provider, useAtom, useAtomValueRaw} from 'jotai'
import type {PropsWithChildren} from 'react'
import {createElement, useContext, useMemo} from 'react'
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
import type {ReactiveNode} from './atoms/ReactiveNode.js'
import {policyAtom} from './atoms/user.js'
import {
  type Dashboard,
  type DashboardContextValue,
  dashboardContext,
  dashboardModelContext,
  editorContext,
  type EntryContextValue,
  entryContext,
  useFieldInfo
} from './contexts.js'

export * from './cms/hooks.js'
export {
  type Dashboard,
  type DashboardContextValue,
  type DashboardOptions,
  useEditor,
  useFieldNode
} from './contexts.js'

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
 * Returns the configured dashboard view component for a field.
 */
export function useFieldView<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useFieldInfo(field)
  return useAtomValueRaw(info.view)
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
