import {Field, FieldOptions} from 'alinea/core'
import {useAtomValue} from 'jotai'
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
  return {
    fieldKey,
    label: options.label,
    options,
    value,
    mutator
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
