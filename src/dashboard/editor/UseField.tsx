import {Field, FieldOptions} from 'alinea/core'
import {useAtomValue} from 'jotai'
import {useFormContext} from '../atoms/FormAtoms.js'

export function useField<Value, Mutator, Options extends FieldOptions>(
  field: Field<Value, Mutator, Options>
) {
  const {label, initialValue} = field[Field.Data]
  const fieldKey = useFieldKey(field)
  const value = useFieldValue(field)
  const mutator = useFieldMutator(field)
  const options = useFieldOptions(field)
  return {
    fieldKey,
    label,
    initialValue,
    options,
    value,
    mutator
  }
}

export function useFieldKey<Value, Mutator, Options extends FieldOptions>(
  field: Field<Value, Mutator, Options>
) {
  const atoms = useFormContext()
  const key = atoms.keyOf(field)
  return key
}

export function useFieldOptions<Value, Mutator, Options extends FieldOptions>(
  field: Field<Value, Mutator, Options>
) {
  const atoms = useFormContext()
  console.log({atoms, field: Field.ref(field)})
  const atom = atoms.atomsOf(field)
  return useAtomValue(atom.options)
}

export function useFieldLabel<Value, Mutator, Options extends FieldOptions>(
  field: Field<Value, Mutator, Options>
) {
  const {label} = field[Field.Data]
  return label
}

export function useFieldValue<Value, Mutator, Options extends FieldOptions>(
  field: Field<Value, Mutator, Options>
) {
  const atoms = useFormContext()
  const atom = atoms.atomsOf(field)
  return useAtomValue(atom.value)
}

export function useFieldMutator<Value, Mutator, Options extends FieldOptions>(
  field: Field<Value, Mutator, Options>
) {
  const atoms = useFormContext()
  const atom = atoms.atomsOf(field)
  return atom.mutator
}
