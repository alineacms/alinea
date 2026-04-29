import {Button, Elevation, Label} from '#/components.js'
import {PreviewMetadata} from '#/core/Preview.js'
import {IcRoundPublic} from '#/dashboard/icons.js'
import {MetadataField} from '#/field/metadata.js'
import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {useFieldError, useFieldNode, useFieldOptions} from '../../../store.js'
import {NodeEditor} from '../../Editor.js'
import {previewMetadataAtom} from '../../PreviewMetadata.js'
import css from './MetadataField.module.css'

const styles = styler(css)

export interface MetadataFieldViewProps {
  field: MetadataField
}

export function MetadataFieldView({field}: MetadataFieldViewProps) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode<object>(field)
  const metadata = useAtomValue(previewMetadataAtom)
  console.log(metadata)
  return (
    <>
      <Label
        label={options.label}
        errorMessage={error}
        isRequired={options.required}
      >
        <Elevation>
          <NodeEditor node={node} type={options.fields} />
        </Elevation>
      </Label>
      <MetadataPreview metadata={metadata} />
    </>
  )
}

interface MetadataPreviewProps {
  metadata?: PreviewMetadata | undefined
}
function MetadataPreview({metadata}: MetadataPreviewProps) {
  if (!metadata) return <p>Swap to preview mode to load the previews</p>
  return (
    <Label label="Metadata previews">
      <OpenGraphPreview metadata={metadata} />
      <SearchEnginePreview metadata={metadata} />
    </Label>
  )
}

interface MetadataProps {
  metadata: PreviewMetadata
}

function OpenGraphPreview({metadata}: MetadataProps) {
  return (
    <Label label="Open Graph Preview">
      <div className={styles.OpenGraphPreview()}>
        <div className={styles.OpenGraphPreview.image()}>
          {metadata['og:image'] ? (
            <img src={metadata['og:image']} alt="" />
          ) : (
            <span>No image</span>
          )}
        </div>
        <div className={styles.OpenGraphPreview.content()}>
          <div className={styles.OpenGraphPreview.site()}>
            {metadata['og:site_name']}
          </div>
          <h3 className={styles.OpenGraphPreview.title()}>
            {metadata['og:title']}
          </h3>
          {metadata['og:description'] && (
            <p className={styles.OpenGraphPreview.description()}>
              {metadata['og:description']}
            </p>
          )}
        </div>
      </div>
    </Label>
  )
}

function SearchEnginePreview({metadata}: MetadataProps) {
  return (
    <Label label="Search Engine Preview">
      <div className={styles.SearchEnginePreview.og()}>
        <Button size="icon" icon={IcRoundPublic} />
        <div className={styles.SearchEnginePreview.og.label()}>
          <span>{metadata['og:site_name'] || 'tempname'}</span>
          <span className={styles.SearchEnginePreview.og.label.small()}>
            {metadata['og:url']}
          </span>
        </div>
      </div>
      <h3 className={styles.SearchEnginePreview.link()}>{metadata['title']}</h3>
      <p className={styles.SearchEnginePreview.description()}>
        {metadata['description']}
      </p>
    </Label>
  )
}
