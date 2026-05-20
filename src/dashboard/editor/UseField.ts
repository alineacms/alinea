import {Field, type FieldOptions} from '#/core/Field.js'
import {assert} from '#/core/util/Assert.js'
import {useAtomValue, useSetAtom} from 'jotai'
import type {DashboardField} from '../store/Dashboard.js'
import {useEditor} from '../store/hooks.js'

export interface UseFieldResult<StoredValue, Mutator, Options> {
  fieldKey: string
  label: string
  options: Options & FieldOptions<StoredValue>
  value: StoredValue
  mutator: Mutator
  error: string | undefined
}

function useFieldInfo(field: Field | string): DashboardField {
  const editor = useEditor()
  const info =
    typeof field === 'string' ? editor.field(field) : editor.get(field)
  const label = typeof field === 'string' ? field : Field.label(field)
  assert(info, `Field not found: ${label}`)
  return info
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useField<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): UseFieldResult<StoredValue, Mutator, Options> {
  const fieldKey = useFieldKey(field)
  const value = useFieldValue(field)
  const mutator = useFieldMutator(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  return {
    fieldKey,
    label: options.label,
    options,
    value,
    mutator,
    error
  }
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useFieldKey<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): string {
  return useFieldInfo(field).key
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useFieldOptions<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): Options & FieldOptions<StoredValue> {
  const info = useFieldInfo(field)
  return useAtomValue(info.options) as Options & FieldOptions<StoredValue>
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useFieldError<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): string | undefined {
  const info = useFieldInfo(field)
  return useAtomValue(info.error)
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useFieldValue<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): StoredValue {
  const info = useFieldInfo(field)
  return useAtomValue(info.value) as StoredValue
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useFieldMutator<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): Mutator {
  const info = useFieldInfo(field)
  return useSetAtom(info.value) as Mutator
}
