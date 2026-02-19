import type {Field, FieldOptions} from 'alinea/core/Field'
import {getScope} from 'alinea/core/Scope'
import {useAtomValue, useSetAtom} from 'jotai'
import {useEffect} from 'react'
import {useFormContext} from '../atoms/FormAtoms.js'
import {useEntryEditor} from '../hook/UseEntryEditor.js'
import {usePolicy} from '../hook/UsePolicy.js'

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
  const policy = usePolicy()
  const editor = useEntryEditor()
  const options = useAtomValue(info.options) as Options &
    FieldOptions<StoredValue>
  if (!editor) return options
  const scope = getScope(editor.config)
  const fieldName = scope.nameOf(field)
  if (!fieldName) return options
  const resource = {type: editor.activeVersion.type, field: fieldName}
  const read = policy.canRead(resource)
  const update = policy.canUpdate(resource)
  return {
    ...options,
    hidden: options.hidden || !read,
    readOnly: options.readOnly || !update
  }
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
