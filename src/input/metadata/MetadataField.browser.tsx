import {Field, Type} from 'alinea/core'
import {InputForm, InputState, useInput} from 'alinea/editor'
import {
  MetadataField,
  MetadataFields,
  metadata as createMetadata
} from './MetadataField.js'

export * from './MetadataField.js'

export const metadata = Field.provideView(MetadataInput, createMetadata)

interface MetadataInputProps {
  state: InputState<InputState.Record<Type.Infer<MetadataFields>>>
  field: MetadataField
}

function MetadataInput({state, field}: MetadataInputProps) {
  const {label, options} = field[Field.Data]
  const parentState = state.parent()
  if (!parentState) throw new Error('Metadata field needs parent state')
  console.log(parentState)
  const [titleSource = ''] = useInput<InputState.Scalar<string>>(
    parentState.child('title')
  )
  console.log(titleSource)
  return <InputForm state={state} type={options.fields} border={false} />
}
