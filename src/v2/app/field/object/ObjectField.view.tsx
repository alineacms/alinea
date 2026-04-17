import {ObjectField} from '#/field/object.js'
import {
  ReactiveNode,
  useFieldError,
  useFieldNode,
  useFieldOptions
} from '../../../store.js'
import {NodeEditor} from '../../Editor.js'
import {Surface, SurfaceContent, SurfaceHeader} from '../../ui/Surface.js'

export interface ObjectFieldViewProps {
  field: ObjectField<object>
}

export function ObjectFieldView({field}: ObjectFieldViewProps) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode(field)
  return (
    <Surface>
      <SurfaceHeader>
        <strong>{options.label}</strong>
      </SurfaceHeader>
      <SurfaceContent>
        <NodeEditor node={node as ReactiveNode<object>} type={options.fields} />
      </SurfaceContent>
    </Surface>
  )
}
