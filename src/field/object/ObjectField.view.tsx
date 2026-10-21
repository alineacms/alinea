import {Field, ListLabel} from '#/components.js'
import {EntryFields} from '#/dashboard/app/EntryFields.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  useFieldError,
  useFieldNode,
  useFieldOptions
} from '#/dashboard/hooks.js'
import {ObjectField} from '#/field/object.js'
import {useState} from 'react'

export interface ObjectFieldViewProps {
  field: ObjectField<object>
}

export function ObjectFieldView({field}: ObjectFieldViewProps) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode(field)
  const [expanded, setExpanded] = useState(!options.collapsed)
  const fields = (
    <NodeEditor node={node as ReactiveNode<object>} type={options.fields}>
      <EntryFields />
    </NodeEditor>
  )
  // A fold without a label next to it is a stray chevron
  if (options.inline || !options.label)
    return (
      <Field
        description={options.help}
        required={options.required}
        error={error}
        shared={options.shared}
      >
        {fields}
      </Field>
    )
  return (
    <Field error={error}>
      <ListLabel
        aria-expanded={expanded}
        expanded={expanded}
        hasRows
        required={options.required}
        description={options.help}
        shared={options.shared}
        onClick={() => setExpanded(!expanded)}
      >
        {options.label}
      </ListLabel>
      {expanded && fields}
    </Field>
  )
}
