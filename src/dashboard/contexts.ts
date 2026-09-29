/**
 * The contexts the dashboard hooks read, see `hooks.tsx`
 *
 * @internal
 */
import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Entry as EntryRecord} from '#/core/Entry.js'
import type {Field} from '#/core/Field.js'
import {assert} from '#/core/util/Assert.js'
import type {WorkspaceInternal} from '#/core/Workspace.js'
import {useAtomValueRaw} from 'jotai'
import {type ComponentType, createContext, useContext} from 'react'
import type {EditorModel, ResolvedEditorImage} from './atoms/editor.js'
import type {EntryAtoms, EntryLocaleAtoms} from './atoms/entry.js'
import type {Page} from './atoms/nav.js'
import type {ReactiveNode} from './atoms/ReactiveNode.js'
import type {RootAtoms} from './atoms/root.js'

export interface EntryContextValue {
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

export const entryContext = createContext<EntryContextValue | null>(null)
export const dashboardContext = createContext<DashboardContextValue | null>(
  null
)
export const dashboardModelContext = createContext<Dashboard | null>(null)
export const editorContext = createContext<EditorModel | null>(null)

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
export function useFieldInfo(field: Field) {
  const editor = useEditor()
  const info = editor.get(field)
  assert(info, 'Field info not found in editor')
  return info
}

/**
 * Returns the reactive node backing a field in the active editor.
 */
export function useFieldNode<Value>(field: Field): ReactiveNode<Value> {
  const {key} = useFieldInfo(field)
  const editor = useEditor()
  const nodes = useAtomValueRaw(editor.node.nodes) as Record<
    string,
    ReactiveNode
  >
  assert(nodes[key], `Node not found for field key: ${key}`)
  return nodes[key] as ReactiveNode<Value>
}
