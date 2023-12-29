import {Field, Section, Type} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {Lift} from 'alinea/ui/Lift'
import {VStack} from 'alinea/ui/Stack'
import {FormAtoms, FormProvider} from '../atoms/FormAtoms.js'
import {ErrorBoundary} from '../view/ErrorBoundary.js'

export interface InputFormProps {
  type: Type
  atoms?: FormAtoms
  border?: boolean
}

export function InputForm({type, atoms, border}: InputFormProps) {
  const inner = (
    <VStack gap={20}>
      {Type.sections(type).map((section, i) => {
        const View = Section.view(section)
        if (View) return <View section={section} key={i} />
        return (
          <div key={i}>
            <Fields fields={Section.fields(section)} border={border} />
          </div>
        )
      })}
    </VStack>
  )
  if (!atoms) return inner
  return <FormProvider atoms={atoms}>{inner}</FormProvider>
}

export interface FieldsProps {
  fields: Record<string, Field>
  border?: boolean
}

export function Fields({fields, border = true}: FieldsProps) {
  const inner = entries(fields)
    .filter(([, field]) => !Field.options(field).hidden)
    .map(([name, field]) => {
      return <Input key={name} field={field} />
    })
  if (inner.length === 0) return null
  return border ? <Lift>{inner}</Lift> : <div>{inner}</div>
}

export interface MissingViewProps {
  field: Field<any, any>
}

export function MissingView({field}: MissingViewProps) {
  return <div>Missing view for field: {field[Field.Data].label}</div>
}

export interface InputProps<V, M> {
  field: Field<V, M>
}

export function Input<V, M>({field}: InputProps<V, M>) {
  const View = field[Field.Data].view
  if (!View) return <MissingView field={field} />
  return (
    <ErrorBoundary>
      <View field={field} />
    </ErrorBoundary>
  )
}
