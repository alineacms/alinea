import {Field, type FieldOptions} from '#/core/Field.js'
import {assert} from '#/core/util/Assert.js'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import type {EditorField} from '../atoms/editor.js'
import {useEditor} from '../hooks.js'

/**
 * The result of the deprecated object-returning `useField`.
 *
 * @deprecated Use the tuple `useField` from 'alinea/cms'.
 */
export interface UseFieldResult<StoredValue, Mutator, Options> {
  fieldKey: string
  label: string
  options: Options & FieldOptions<StoredValue>
  value: StoredValue
  mutator: Mutator
  error: string | undefined
}

function useFieldInfo(field: Field | string): EditorField {
  const editor = useEditor()
  const info =
    typeof field === 'string' ? editor.field(field) : editor.get(field)
  const label = typeof field === 'string' ? field : Field.label(field)
  assert(info, `Field not found: ${label}`)
  return info
}

/**
 * Compatibility hook for dashboard extensions written for Alinea 1.x.
 * Also accepts the field's key instead of the field.
 *
 * @deprecated Use the tuple `useField` from 'alinea/cms' (`const [value, setValue] = useField(field)`) with `useFieldOptions` and `useFieldError`.
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
 * Compatibility hook for dashboard extensions written for Alinea 1.x.
 * Also accepts the field's key instead of the field.
 *
 * @deprecated Use `useFieldKey` from 'alinea/cms'.
 */
export function useFieldKey<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): string {
  return useFieldInfo(field).key
}

/**
 * Compatibility hook for dashboard extensions written for Alinea 1.x.
 * Also accepts the field's key instead of the field.
 *
 * @deprecated Use `useFieldOptions` from 'alinea/cms'.
 */
export function useFieldOptions<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): Options & FieldOptions<StoredValue> {
  const info = useFieldInfo(field)
  return useAtomValueRaw(info.options) as Options & FieldOptions<StoredValue>
}

/**
 * Compatibility hook for dashboard extensions written for Alinea 1.x.
 * Also accepts the field's key instead of the field.
 *
 * @deprecated Use `useFieldError` from 'alinea/cms'.
 */
export function useFieldError<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): string | undefined {
  const info = useFieldInfo(field)
  return useAtomValueRaw(info.error)
}

/**
 * Compatibility hook for dashboard extensions written for Alinea 1.x.
 * Also accepts the field's key instead of the field.
 *
 * @deprecated Use `useFieldValue` from 'alinea/cms'.
 */
export function useFieldValue<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): StoredValue {
  const info = useFieldInfo(field)
  return useAtomValueRaw(info.value) as StoredValue
}

/**
 * Compatibility hook for dashboard extensions written for Alinea 1.x.
 * Also accepts the field's key instead of the field.
 *
 * @deprecated Use `useFieldSetter` from 'alinea/cms'.
 */
export function useFieldMutator<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
): Mutator {
  const info = useFieldInfo(field)
  return useSetAtom(info.value) as Mutator
}
