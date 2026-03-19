import {Label} from '@alinea/components'
import {ObjectField} from 'alinea/field/object'
import {useFieldError, useFieldNode, useFieldOptions} from '../../store.js'
import {NodeEditor} from '../Editor.js'

export interface ObjectFieldViewProps {
  field: ObjectField<object>
}

export function ObjectFieldView({field}: ObjectFieldViewProps) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode(field)
  return (
    <Label label={options.label} errorMessage={error}>
      <NodeEditor node={node} type={options.fields} />
    </Label>
  )
}
