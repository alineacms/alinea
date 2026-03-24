import {Button, DialogTrigger, Elevation, Label} from '@alinea/components'
import {styler} from '@alinea/styler'
import {createId} from 'alinea/core/Id.js'
import {Reference} from 'alinea/core/Reference'
import {LinkField} from 'alinea/field/link/LinkField'
import {EntryReference} from 'alinea/types.js'
import {useAtomValue} from 'jotai'
import {
  ReactiveNode,
  useDashboard,
  useFieldNode,
  useFieldOptions,
  useFieldSetter
} from '../../store.js'
import {LinkPicker} from '../LinkPicker.js'
import css from './LinkField.module.css'

const styles = styler(css)

interface LinkRowProps {
  node: ReactiveNode<Reference>
}

function LinkRow({node}: LinkRowProps) {
  const dashboard = useDashboard()
  const entryId = useAtomValue(node.field._entry) as string
  const entry = useAtomValue(dashboard.entries[entryId])
  const label = useAtomValue(entry.label)
  return <Elevation>Link: {label}</Elevation>
}

export interface SingleLinkFieldViewProps {
  field: LinkField<EntryReference, unknown>
}

export function SingleLinkFieldView({field}: SingleLinkFieldViewProps) {
  const setValue = useFieldSetter(field)
  const options = useFieldOptions(field)
  const node = useFieldNode(field)
  const isEmpty = useAtomValue(node.isEmpty)
  return (
    <Label label={options.label}>
      <Elevation>
        {!isEmpty && <LinkRow node={node as ReactiveNode<Reference>} />}
      </Elevation>
      <DialogTrigger>
        <Button>Pick a link</Button>
        <LinkPicker
          selectionMode="single"
          selectionBehavior="replace"
          onConfirm={selection =>
            setValue({
              _id: createId(),
              _type: 'entry',
              _entry: selection[0]
            })
          }
        />
      </DialogTrigger>
      <Button onPress={() => setValue(undefined!)}>Clear link</Button>
    </Label>
  )
}

export interface MultipleLinksFieldViewProps {
  field: LinkField<Reference, Reference>
}

export function MultipleLinksFieldView({field}: MultipleLinksFieldViewProps) {
  const options = useFieldOptions(field)
  const node = useFieldNode(field)
  const nodes = useAtomValue(node.nodes) as Array<ReactiveNode<Reference>>
  return (
    <Label label={options.label}>
      <Elevation>
        {nodes.map((node, index) => (
          <LinkRow key={index} node={node} />
        ))}
      </Elevation>
      <DialogTrigger>
        <Button>Pick a link</Button>
        <LinkPicker selectionMode="multiple" selectionBehavior="toggle" />
      </DialogTrigger>
    </Label>
  )
}
