import {Field} from '#/components.js'
import {EntryFields, NodeEditor} from '#/dashboard/app/EntryFields.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  useFieldError,
  useFieldNode,
  useFieldOptions
} from '#/dashboard/hooks.js'
import {ObjectField} from '#/field/object.js'

export interface ObjectFieldViewProps {
  field: ObjectField<object>
}

export function ObjectFieldView({field}: ObjectFieldViewProps) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode(field)
  return (
    <Field
      label={options.inline ? undefined : options.label}
      description={options.help}
      required={options.required}
      error={error}
      shared={options.shared}
    >
      <NodeEditor node={node as ReactiveNode<object>} type={options.fields}>
        <EntryFields />
      </NodeEditor>
    </Field>
  )
}
