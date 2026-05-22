import type {Config} from '#/core/Config.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Entry as EntryRecord} from '#/core/Entry.js'
import type {Field} from '#/core/Field.js'
import type {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {Type} from '#/index.js'
import {atom, type Atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap, useHydrateAtoms} from 'jotai/utils'
import type {
  DependencyList,
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
const graphQueryCache = new WeakMap<
  Dashboard,
  Map<string, GraphQueryCacheEntry<unknown>>
>()

interface GraphQueryCacheEntry<Result> {
  atom: Atom<Result | Promise<Result>>
  entry: EntryRecord<Record<string, unknown>> | null
  query: (context: DashboardGraphQueryContext) => Result | Promise<Result>
}

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

export interface DashboardGraphQueryContext {
  config: Config
  entry: EntryRecord<Record<string, unknown>> | null
  graph: WriteableGraph
  policy: Policy
  user: User | null
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
 * Runs a graph-backed query in the active dashboard context.
 *
 * The query suspends while loading, keeps the previous resolved value during
 * background reloads, and re-runs when the dashboard SHA, selected entry
 * version, or dependency list changes.
 */
export function useGraphQuery<Result>(
  query: (context: DashboardGraphQueryContext) => Result | Promise<Result>,
  dependencies: DependencyList = []
): Result {
  const dashboard = useDashboard()
  const entry = useEntry()
  const entryKey = entry
    ? `${entry.id}\0${entry.locale ?? ''}\0${entry.status}\0${entry.fileHash}`
    : ''
  const queryKey = graphQueryKey(entryKey, dependencies, query)
  const queryAtom = graphQueryAtom(dashboard, queryKey, entry, query)
  return useAtomValue(queryAtom)
}

function graphQueryAtom<Result>(
  dashboard: Dashboard,
  key: string,
  entry: EntryRecord<Record<string, unknown>> | null,
  query: (context: DashboardGraphQueryContext) => Result | Promise<Result>
): Atom<Result | Promise<Result>> {
  let dashboardCache = graphQueryCache.get(dashboard)
  if (!dashboardCache) {
    dashboardCache = new Map()
    graphQueryCache.set(dashboard, dashboardCache)
  }
  let cached = dashboardCache.get(key) as
    | GraphQueryCacheEntry<Result>
    | undefined
  if (!cached) {
    let cacheEntry: GraphQueryCacheEntry<Result>
    const resource = atom(async get => {
      get(dashboard.sha)
      const graph = get(dashboard.db)
      const config = get(dashboard.config)
      const policy = get(dashboard.policy)
      const user = (await get(dashboard.user)) ?? null
      return cacheEntry.query({
        config,
        entry: cacheEntry.entry,
        graph,
        policy,
        user
      })
    })
    const state = unwrap(
      atom(async get => ({data: await get(resource)})),
      previous => previous
    )
    cached = {
      entry,
      query,
      atom: atom(get => {
        const current = get(state)
        if (current) return current.data
        return get(resource)
      })
    }
    cacheEntry = cached
    dashboardCache.set(key, cached as GraphQueryCacheEntry<unknown>)
  }
  return cached.atom
}

function graphQueryKey<Result>(
  entryKey: string,
  dependencies: DependencyList,
  query: (context: DashboardGraphQueryContext) => Result | Promise<Result>
): string {
  return `${entryKey}\0${query.toString()}\0${dependencyKey(dependencies)}`
}

const objectDependencyKeys = new WeakMap<object, number>()
const symbolDependencyKeys = new Map<symbol, number>()
let dependencyKeyIndex = 0

function dependencyKey(value: DependencyList): string {
  return value
    .map(part => {
      if (part === null) return 'null:null'
      switch (typeof part) {
        case 'string':
          return `string:${part}`
        case 'number':
          return `number:${Object.is(part, -0) ? '-0' : part}`
        case 'boolean':
          return `boolean:${part}`
        case 'undefined':
          return 'undefined:undefined'
        case 'bigint':
          return `bigint:${part}`
        case 'symbol': {
          let key = symbolDependencyKeys.get(part)
          if (!key) {
            key = ++dependencyKeyIndex
            symbolDependencyKeys.set(part, key)
          }
          return `symbol:${key}`
        }
        default:
          return `object:${objectDependencyKey(part)}`
      }
    })
    .join('\0')
}

function objectDependencyKey(value: object): number {
  let key = objectDependencyKeys.get(value)
  if (!key) {
    key = ++dependencyKeyIndex
    objectDependencyKeys.set(value, key)
  }
  return key
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
