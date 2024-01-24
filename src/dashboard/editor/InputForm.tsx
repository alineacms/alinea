import {Field, Section, Type} from 'alinea/core'
import {entries} from 'alinea/core/util/Objects'
import {useFieldOptions} from 'alinea/dashboard/editor/UseField'
import {Lift} from 'alinea/ui/Lift'
import {VStack} from 'alinea/ui/Stack'
import {FormAtoms, FormProvider} from '../atoms/FormAtoms.js'
import {ErrorBoundary} from '../view/ErrorBoundary.js'

export type InputFormProps = {
  border?: boolean
} & ({type: Type; form?: undefined} | {form: FormAtoms<any>; type?: undefined})

export function InputForm(props: InputFormProps) {
  const type = props.type ?? props.form.type
  const inner = (
    <VStack gap={20}>
      {Type.sections(type).map((section, i) => {
        const View = Section.view(section)
        if (View) return <View section={section} key={i} />
        return (
          <div key={i} style={{display: 'contents'}}>
            <Fields fields={Section.fields(section)} border={props.border} />
          </div>
        )
      })}
    </VStack>
  )
  if (!props.form) return inner
  return <FormProvider form={props.form}>{inner}</FormProvider>
}

export interface FieldsProps {
  fields: Record<string, Field>
  border?: boolean
}

export function Fields({fields, border = true}: FieldsProps) {
  const inner = entries(fields).map(([name, field]) => {
    return <InputField key={name} field={field} />
  })
  if (inner.length === 0) return null
  return border ? <Lift>{inner}</Lift> : <div>{inner}</div>
}

export interface MissingViewProps {
  field: Field<any, any>
}

export function MissingView({field}: MissingViewProps) {
  return <div>Missing view for field: {Field.label(field)}</div>
}

export interface InputFieldProps<V, M> {
  field: Field<V, M>
}

export function InputField<V, M>({field}: InputFieldProps<V, M>) {
  const View = field[Field.Data].view
  const options = useFieldOptions(field)
  if (!View) return <MissingView field={field} />
  if (options.hidden) return null
  return (
    <ErrorBoundary>
      <View field={field} />
    </ErrorBoundary>
  )
}
