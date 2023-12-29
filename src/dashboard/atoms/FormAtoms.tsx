import {Field, FieldOptions} from 'alinea/core'
import {Atom} from 'jotai'
import {PropsWithChildren, createContext, useContext} from 'react'

export interface FormAtoms {
  atomsOf<Value, Mutator, Options extends FieldOptions>(
    field: Field<Value, Mutator, Options>
  ): {
    value: Atom<Value>
    mutator: Atom<Mutator>
    childAtoms(key: string): FormAtoms
  }
}

const fieldAtomsContext = createContext<FormAtoms | undefined>(undefined)

export function useFormAtoms() {
  const fieldAtoms = useContext(fieldAtomsContext)
  if (!fieldAtoms) throw new Error('FieldAtoms is not provided')
  return fieldAtoms
}

export interface FieldAtomsProviderProps {
  atoms: FormAtoms
}

export function FormProvider({
  children,
  atoms
}: PropsWithChildren<FieldAtomsProviderProps>) {
  return (
    <fieldAtomsContext.Provider value={atoms}>
      {children}
    </fieldAtomsContext.Provider>
  )
}

export interface FormRowProps {
  field: Field
  id: string
}

export function FormRow({
  children,
  field,
  id
}: PropsWithChildren<FormRowProps>) {
  const atoms = useFormAtoms()
  const {childAtoms} = atoms.atomsOf(field)
  return <FormProvider atoms={childAtoms(id)}>{children}</FormProvider>
}
