import {Field} from '#/core/Field.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {resolveView} from '#/core/View.js'
import {useFieldOptions} from '#/dashboard/editor/UseField.js'
import {ErrorMessage} from '#/ui.js'
import {Lift} from '#/ui/Lift.js'
import {VStack} from '#/ui/Stack.js'
import {type FormAtoms, FormProvider} from '../atoms/FormAtoms.js'
import {useDashboard} from '../hook/UseDashboard.js'
import {ErrorBoundary} from '../view/ErrorBoundary.js'

export type InputFormProps = {
  border?: boolean
} & ({type: Type; form?: undefined} | {form: FormAtoms<any>; type?: undefined})

export function InputForm(props: InputFormProps) {
  const {views} = useDashboard()
  const type = props.type ?? props.form.type
  const inner = (
    <VStack gap={20}>
      {Type.sections(type).map((section, i) => {
        const view = Section.view(section)
        const View = view ? resolveView(views, view) : undefined
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
  return (
    <ErrorMessage error={`Missing view for field: ${Field.label(field)}`} />
  )
}

export interface InputFieldProps<V, M> {
  field: Field<V, M>
}

export function InputField<V, M>({field}: InputFieldProps<V, M>) {
  const {views} = useDashboard()
  const view = Field.view(field)
  const options = useFieldOptions(field)
  const View = resolveView(views, view)
  if (!View) return <MissingView field={field} />
  if (options.hidden) return null
  return (
    <ErrorBoundary>
      <View field={field} />
    </ErrorBoundary>
  )
}
