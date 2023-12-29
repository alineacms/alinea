import {Field, FieldOptions} from 'alinea/core'
import {useAtomValue} from 'jotai'
import {useFormAtoms} from '../atoms/FormAtoms.js'

export function useField<Value, Mutator, Options extends FieldOptions>(
  field: Field<Value, Mutator, Options>
) {
  const {label, initialValue} = field[Field.Data]
  const value = useFieldValue(field)
  const mutator = useFieldMutator(field)
  const options = useFieldOptions(field)
  return {
    label,
    initialValue,
    options,
    value,
    mutator
  }
}

export function useFieldOptions<Value, Mutator, Options extends FieldOptions>(
  field: Field<Value, Mutator, Options>
) {
  const {options} = field[Field.Data]
  return options
}

export function useFieldValue<Value, Mutator, Options extends FieldOptions>(
  field: Field<Value, Mutator, Options>
) {
  const atoms = useFormAtoms()
  const atom = atoms.atomsOf(field)
  return useAtomValue(atom.value)
}

export function useFieldMutator<Value, Mutator, Options extends FieldOptions>(
  field: Field<Value, Mutator, Options>
) {
  const atoms = useFormAtoms()
  const atom = atoms.atomsOf(field)
  return useAtomValue(atom.mutator)
}
