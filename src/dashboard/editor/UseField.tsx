import {Field, FieldOptions} from 'alinea/core'
import {useAtomValue} from 'jotai'
import {useCallback, useMemo} from 'react'
import {useFormContext} from '../atoms/FormAtoms.js'

export function useField<Value, Mutator, Options extends FieldOptions<Value>>(
  field: Field<Value, Mutator, Options> | string
) {
  const atoms = useFormContext()
  const actual =
    typeof field === 'string'
      ? (atoms.fieldByKey(field) as Field<Value, Mutator, Options>)
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

export function useFieldKey<
  Value,
  Mutator,
  Options extends FieldOptions<Value>
>(field: Field<Value, Mutator, Options>) {
  const atoms = useFormContext()
  const key = atoms.keyOf(field)
  return key
}

export function useFieldOptions<
  Value,
  Mutator,
  Options extends FieldOptions<Value>
>(field: Field<Value, Mutator, Options>) {
  const atoms = useFormContext()
  const atom = atoms.fieldInfo(field)
  return useAtomValue(atom.options)
}

export function useFieldError<
  Value,
  Mutator,
  Options extends FieldOptions<Value>
>(field: Field<Value, Mutator, Options>) {
  const value = useFieldValue(field)
  const options = useFieldOptions(field)
  const hasError = useCallback(
    (value: Value) => {
      if (options.validate) {
        const validates = options.validate(value)
        if (typeof validates === 'boolean') return !validates
        return validates
      }
      const isRequired = options.required
      const isEmpty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      if (isRequired && isEmpty) return true
    },
    [options]
  )
  return useMemo(() => {
    return hasError(value)
  }, [hasError, value])
}

export function useFieldValue<
  Value,
  Mutator,
  Options extends FieldOptions<Value>
>(field: Field<Value, Mutator, Options>) {
  const atoms = useFormContext()
  const atom = atoms.fieldInfo(field)
  return useAtomValue(atom.value)
}

export function useFieldMutator<
  Value,
  Mutator,
  Options extends FieldOptions<Value>
>(field: Field<Value, Mutator, Options>) {
  const atoms = useFormContext()
  const atom = atoms.fieldInfo(field)
  return atom.mutator
}
