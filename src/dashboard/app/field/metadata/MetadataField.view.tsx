import {Elevation, Label} from '#/components.js'
import {MetadataField} from '#/field/metadata.js'
import {useAtomValue} from 'jotai'
import {useFieldError, useFieldNode, useFieldOptions} from '../../../store.js'
import {NodeEditor} from '../../Editor.js'
import {previewMetadataAtom} from '../../PreviewMetadata.js'

export interface MetadataFieldViewProps {
  field: MetadataField
}

export function MetadataFieldView({field}: MetadataFieldViewProps) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode<object>(field)
  const metadata = useAtomValue(previewMetadataAtom)
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
