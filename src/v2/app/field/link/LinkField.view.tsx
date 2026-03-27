import {Button, DialogTrigger, Elevation, Label} from '@alinea/components'
import {styler} from '@alinea/styler'
import {createId} from 'alinea/core/Id'
import {Reference} from 'alinea/core/Reference'
import {ListRow} from 'alinea/core/shape/ListShape'
import {LinkField, LinksField} from 'alinea/field/link/LinkField'
import {EntryReference} from 'alinea/types.js'
import {useAtomValue} from 'jotai'
import {
  ReactiveNode,
  useDashboard,
  useFieldNode,
  useFieldOptions,
  useFieldValue
} from '../../../store.js'
import {LinkPicker} from '../../LinkPicker.js'
import css from './LinkField.module.css'

const styles = styler(css)

interface EntryRowProps {
  entryId: string
}

function EntryRow({entryId}: EntryRowProps) {
  const dashboard = useDashboard()
  const entry = useAtomValue(dashboard.entries[entryId])
  const label = useAtomValue(entry.label)
  const type = useAtomValue(entry.type)
  return (
    <Elevation>
      {label} ({type.label})
    </Elevation>
  )
}

interface LinkRowProps {
  node: ReactiveNode<Reference>
}

function LinkRow({node}: LinkRowProps) {
  const entryId = useAtomValue(node.field._entry) as string | undefined
  if (!entryId) return null
  return <EntryRow entryId={entryId} />
}

export interface SingleLinkFieldViewProps {
  field: LinkField<EntryReference, unknown>
}

export function SingleLinkFieldView({field}: SingleLinkFieldViewProps) {
  const [value, setValue] = useFieldValue(field)
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
          initialSelection={value?._entry ? [value._entry] : []}
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
  field: LinksField<ListRow, Reference>
}

export function MultipleLinksFieldView({field}: MultipleLinksFieldViewProps) {
  const [value, setValue] = useFieldValue(field)
  const options = useFieldOptions(field)
  const node = useFieldNode(field)
  const nodes = useAtomValue(node.nodes) as Array<ReactiveNode<Reference>>
  return (
    <Label label={options.label}>
      <Elevation>
        {nodes?.map((node, index) => (
          <LinkRow key={index} node={node} />
        ))}
      </Elevation>
      <DialogTrigger>
        <Button>Pick a link</Button>
        <LinkPicker
          selectionMode="multiple"
          selectionBehavior="toggle"
          initialSelection={value
            ?.filter(row => '_entry' in row)
            .map(row => row._entry as string)}
          onConfirm={selection =>
            setValue(
              selection.map(entryId => ({
                _id: createId(),
                _index: undefined!,
                _type: 'entry',
                _entry: entryId
              }))
            )
          }
        />
      </DialogTrigger>
    </Label>
  )
}
