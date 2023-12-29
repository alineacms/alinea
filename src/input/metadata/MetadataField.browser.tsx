import {Field} from 'alinea/core'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useFieldOptions} from 'alinea/dashboard/editor/UseField'
import {MetadataField, metadata as createMetadata} from './MetadataField.js'

export * from './MetadataField.js'

export const metadata = Field.provideView(MetadataInput, createMetadata)

interface MetadataInputProps {
  field: MetadataField
}

function MetadataInput({field}: MetadataInputProps) {
  const options = useFieldOptions(field)
  return <InputForm type={options.fields} border={false} />
}
