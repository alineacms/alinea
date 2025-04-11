import type {Field, FieldOptions} from 'alinea/core/Field'
import {useAtomValue, useSetAtom} from 'jotai'
import {useEffect} from 'react'
import {useFormContext} from '../atoms/FormAtoms.js'

export function useField<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options> | string
) {
  const form = useFormContext()
  const actual =
    typeof field === 'string'
      ? (form.fieldByKey(field) as Field<
          StoredValue,
          QueryValue,
          Mutator,
          Options
        >)
      : field
  const fieldKey = useFieldKey(actual)
  const value = useFieldValue(actual)
  const mutator = useFieldMutator(actual)
  const options = useFieldOptions(actual)
  const error = useFieldError(actual)
  return {
    fieldKey,
    label: options.label,
    options,
    value,
    mutator,
    error
  }
}

export function useFieldKey<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const atoms = useFormContext()
  const key = atoms.keyOf(field)
  return key
}

export function useFieldOptions<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
): Options & FieldOptions<StoredValue> {
  const form = useFormContext()
  const info = form.fieldInfo(field)
  return useAtomValue(info.options) as Options & FieldOptions<StoredValue>
}

export function useFieldError<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const form = useFormContext()
  const info = form.fieldInfo(field)
  const setError = useSetAtom(form.errors)
  const key = useFieldKey(field)
  const fieldPath = `${form.path}.${key}`
  const error = useAtomValue(info.error)
  useEffect(() => {
    setError(fieldPath, field, error)
    return () => setError(fieldPath, field, undefined)
  }, [setError, fieldPath, field, error])
  return error
}

export function useFieldValue<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const form = useFormContext()
  const info = form.fieldInfo(field)
  return useAtomValue(info.value)
}

export function useFieldMutator<StoredValue, QueryValue, Mutator, Options>(
  field: Field<StoredValue, QueryValue, Mutator, Options>
) {
  const form = useFormContext()
  const info = form.fieldInfo(field)
  return info.mutator
}
