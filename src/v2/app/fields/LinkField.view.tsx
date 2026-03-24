import {Button, DialogTrigger, Elevation, Label} from '@alinea/components'
import {styler} from '@alinea/styler'
import {createId} from 'alinea/core/Id.js'
import {Reference} from 'alinea/core/Reference'
import {LinkField} from 'alinea/field/link/LinkField'
import {EntryReference} from 'alinea/types.js'
import {useAtomValue} from 'jotai'
import {
  ObjectNode,
  useFieldNode,
  useFieldOptions,
  useFieldSetter
} from '../../store.js'
import {LinkPicker} from '../LinkPicker.js'
import css from './LinkField.module.css'

const styles = styler(css)

interface LinkRowProps {
  node: ObjectNode<Reference>
}

function LinkRow({node}: LinkRowProps) {
  const id = useAtomValue(node.field._id)
  return <Elevation>Link: {id}</Elevation>
}

export interface SingleLinkFieldViewProps {
  field: LinkField<EntryReference, unknown>
}

export function SingleLinkFieldView({field}: SingleLinkFieldViewProps) {
  const setValue = useFieldSetter(field)
  const options = useFieldOptions(field)
  const node = useFieldNode(field)
  return (
    <Label label={options.label}>
      <Elevation>
        {node instanceof ObjectNode ? (
          <LinkRow node={node as ObjectNode<Reference>} />
        ) : (
          'No link selected'
        )}
      </Elevation>
      <DialogTrigger>
        <Button>Pick a link</Button>
        <LinkPicker
          selectionMode="single"
          selectionBehavior="toggle"
          onConfirm={selection =>
            setValue({
              _id: createId(),
              _type: 'entry',
              _entry: selection[0]
            })
          }
        />
      </DialogTrigger>
    </Label>
  )
}

export interface MultipleLinksFieldViewProps {
  field: LinkField<Reference, Reference>
}

export function MultipleLinksFieldView({field}: MultipleLinksFieldViewProps) {
  return (
    <div>
      Pick multiple links
      <DialogTrigger>
        <Button>Pick a link</Button>
        <LinkPicker selectionMode="multiple" selectionBehavior="toggle" />
      </DialogTrigger>
    </div>
  )
}
