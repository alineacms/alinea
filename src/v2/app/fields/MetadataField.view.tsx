import {Elevation, Label} from '@alinea/components'
import {MetadataField} from 'alinea/field/metadata'
import {useFieldError, useFieldNode, useFieldOptions} from '../../store.js'
import {NodeEditor} from '../Editor.js'

export interface MetadataFieldViewProps {
  field: MetadataField
}

export function MetadataFieldView({field}: MetadataFieldViewProps) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode<object>(field)
  return (
    <Label
      label={options.label}
      errorMessage={error}
      isRequired={options.required}
    >
      <Elevation>
        <NodeEditor node={node} type={options.fields} />
      </Elevation>
    </Label>
  )
}
