import type {PropsWithChildren} from 'react'
import {createContext, createElement, useContext, useMemo} from 'react'
import type {Field} from 'alinea/core/Field'
import type {Type} from 'alinea/core/Type'
import {assert} from 'alinea/core/util/Assert.js'
import {atom} from 'jotai'
import type {Atom, WritableAtom} from 'jotai'
import {useAtom, useAtomValue} from 'jotai'
import {DashboardEditor} from './Dashboard.js'
import type {DashboardEntry} from './Dashboard.js'

interface DashboardScope {
  editor: DashboardEditor
  path: Array<string>
}

const scopeContext = createContext<DashboardScope | null>(null)
const entryContext = createContext<DashboardEntry | null>(null)

export interface EditorScopeProps {
  editor: DashboardEditor
}

export function EditorScope({
  children,
  editor
}: PropsWithChildren<EditorScopeProps>) {
  const parent = useContext(scopeContext)
  return createElement(
    scopeContext.Provider,
    {value: {editor, path: parent?.path ?? []}},
    children
  )
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

export function useDashboardEditor() {
  return useDashboardScope().editor
}

export function useField<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useFieldInfo(field)
  return useAtom(info.value)
}

export function useFieldKey<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useFieldInfo(field)
  return info.key
}

export function useFieldPath<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const {path} = useDashboardScope()
  const key = useFieldKey(field)
  return [...path, key].join('.')
}

export function useFieldOptions<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useFieldInfo(field)
  return useAtomValue(info.options) as Options
}

export function useFieldError<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const info = useFieldInfo(field)
  return useAtomValue(info.error)
}

export function useSiblingFieldValue(key: string) {
  const editor = useDashboardEditor()
  const info = editor.field[key]
  assert(info, `Field not found: ${key}`)
  return useAtomValue(info.value)
}

export function useFieldScope<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>,
  type: Type
) {
  const scope = useDashboardScope()
  const info = useFieldInfo(field)
  const key = useFieldKey(field)
  const nested = useMemo(() => {
    return new DashboardEditor(
      scope.editor.dashboard,
      type,
      atom(
        get => {
          const current = get(info.value)
          if (current && typeof current === 'object' && !Array.isArray(current))
            return current as Record<string, unknown>
          return {}
        },
        (get, set, update: FieldUpdate<Record<string, unknown>>) => {
          const current = get(info.value)
          const scoped =
            current && typeof current === 'object' && !Array.isArray(current)
              ? (current as Record<string, unknown>)
              : {}
          const next = applyUpdate(update, scoped)
          set(info.value, next)
        }
      )
    )
  }, [info.value, scope.editor.dashboard, type])
  return useMemo(() => {
    function Scope({children}: PropsWithChildren) {
      return createElement(scopeContext.Provider, {
        value: {editor: nested, path: [...scope.path, key]},
        children
      })
    }
    return Scope
  }, [key, nested, scope.path])
}

export function useGraph() {
  const editor = useDashboardEditor()
  return useAtomValue(editor.dashboard.db)
}

export function useEntry() {
  return useContext(entryContext)
}

function useFieldInfo<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const editor = useDashboardEditor()
  const info = editor.byField.get(field)
  assert(info, `Field not found: ${String(field)}`)
  return info as {
    key: string
    value: WritableAtom<
      StoredValue,
      [StoredValue | ((value: StoredValue) => StoredValue)],
      void
    >
    options: Atom<Options>
    error: Atom<boolean | string | undefined>
  }
}

function useDashboardScope() {
  const scope = useContext(scopeContext)
  assert(scope, 'Missing Dashboard editor scope')
  return scope
}

type FieldUpdate<Value> = Value | ((value: Value) => Value)

function applyUpdate<Value>(update: FieldUpdate<Value>, current: Value): Value {
  return typeof update === 'function'
    ? (update as (value: Value) => Value)(current)
    : update
}
