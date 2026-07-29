import {Field} from '#/core/Field.js'
import {assert} from '#/core/util/Assert.js'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import type {Dispatch, SetStateAction} from 'react'
import type {ReactiveNode} from '../atoms/entry/editor.js'
import {useEditor} from './EditorScope.js'

function useFieldInfo(field: Field) {
  const info = useEditor().get(field)
  assert(info, `Field not found: ${Field.label(field)}`)
  return info
}

export function useFieldNode<Value>(field: Field): ReactiveNode<Value> {
  const info = useFieldInfo(field)
  const nodes = useAtomValue(info.draft.node.nodes) as Record<
    string,
    ReactiveNode
  >
  const node = nodes[info.key]
  assert(node, `Node not found for field key: ${info.key}`)
  return node as ReactiveNode<Value>
}

export function useFieldValue<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): StoredValue {
  return useAtomValue(useFieldInfo(field).value) as StoredValue
}

export function useField<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): [StoredValue, Dispatch<SetStateAction<StoredValue>>] {
  const info = useFieldInfo(field)
  const value = useAtomValue(info.value) as StoredValue
  const setValue = useSetAtom(info.value)
  return [value, setValue]
}

export function useFieldSetter<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): Dispatch<SetStateAction<StoredValue>> {
  return useSetAtom(useFieldInfo(field).value)
}

export function useFieldKey<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): string {
  return useFieldInfo(field).key
}

export function useFieldOptions<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  return useAtomValue(useFieldInfo(field).options) as Options
}

export function useFieldError<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): string | undefined {
  return useAtomValue(useFieldInfo(field).error)
}

export function useFieldView<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  return useAtomValue(useFieldInfo(field).view)
}

export function useSiblingFieldValue(key: string) {
  const info = useEditor().field(key)
  assert(info, `Field not found: ${key}`)
  return useAtomValue(info.value)
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
export function useNodes<Value>(node: ReactiveNode<Value>): unknown {
  return useAtomValue(node.nodes)
}
