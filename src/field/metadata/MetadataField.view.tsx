import {Button, Elevation, Label} from '#/components.js'
import {PreviewMetadata} from '#/core/Preview.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {Surface, SurfaceContent} from '#/dashboard/app/ui/Surface.js'
import {IcRoundPublic} from '#/dashboard/icons.js'
import {
  useDashboard,
  useFieldError,
  useFieldNode,
  useFieldOptions,
  useFieldValue
} from '#/dashboard/store.js'
import {
  MetadataField,
  MetadataTimestampField,
  MetadataUserField
} from '#/field/metadata.js'
import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import css from './MetadataField.module.css'

const styles = styler(css)

export interface MetadataFieldViewProps {
  field: MetadataField
}

export interface MetadataTimestampFieldViewProps {
  field: MetadataTimestampField
}

export function MetadataTimestampFieldView({
  field
}: MetadataTimestampFieldViewProps) {
  const value = useFieldValue(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const displayValue = formatAuditTimestamp(value)
  return (
    <Label label={options.label} errorMessage={error}>
      <div className={styles.MetadataTimestampFieldView()}>
        {displayValue || 'Not available'}
      </div>
    </Label>
  )
}

export interface MetadataUserFieldViewProps {
  field: MetadataUserField
}

export function MetadataUserFieldView({field}: MetadataUserFieldViewProps) {
  const value = useFieldValue(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const name = value?.name || 'Unknown user'
  const email = value?.email
  return (
    <Label label={options.label} errorMessage={error}>
      <div className={styles.MetadataUserFieldView()}>
        <div className={styles.MetadataUserFieldView.person()}>{name}</div>
        {email && (
          <div className={styles.MetadataUserFieldView.contact()}>
            &lt;{email}&gt;
          </div>
        )}
      </div>
    </Label>
  )
}

export function MetadataFieldView({field}: MetadataFieldViewProps) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode<object>(field)
  const dashboard = useDashboard()
  const metadata = useAtomValue(dashboard.previewMetadata)
  return (
    <>
      <Label label={options.label} errorMessage={error}>
        <Elevation>
          <NodeEditor node={node} type={options.fields} />
        </Elevation>
      </Label>
      <MetadataPreview metadata={metadata} origin={origin} />
    </>
  )
}

function formatAuditTimestamp(value: number | string | null): string {
  if (value === null) return ''
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  }).format(date)
}

interface MetadataPreviewProps {
  metadata?: PreviewMetadata | undefined
  origin?: string | undefined
}
function MetadataPreview({metadata, origin}: MetadataPreviewProps) {
  if (!metadata)
    return (
      <Label
        label="Open preview mode to display a metadata preview"
        style={{marginTop: '32px'}}
      />
    )
  return (
    <Label label="Metadata previews" style={{marginTop: '32px'}}>
      <SearchEnginePreview metadata={metadata} origin={origin} />
      <OpenGraphPreview metadata={metadata} origin={origin} />
    </Label>
  )
}

interface MetadataProps {
  metadata: PreviewMetadata
  origin?: string | undefined
}

function OpenGraphPreview({metadata, origin}: MetadataProps) {
  return (
    <Label label="Open Graph Preview (Social Share)">
      <Surface className={styles.OpenGraphPreview()}>
        <div className={styles.OpenGraphPreview.image()}>
          {metadata['og:image'] ? (
            <img src={metadata['og:image']} alt="" />
          ) : (
            <span>No image</span>
          )}
        </div>
        <SurfaceContent className={styles.OpenGraphPreview.content()}>
          <div className={styles.OpenGraphPreview.site()}>
            {origin || metadata['og:site_name']}
          </div>
          <h3 className={styles.OpenGraphPreview.title()}>
            {metadata['og:title']}
          </h3>
          {/* {metadata['og:description'] && (
            <p className={styles.OpenGraphPreview.description()}>
              {metadata['og:description']}
            </p>
          )} */}
        </SurfaceContent>
      </Surface>
    </Label>
  )
}

function SearchEnginePreview({metadata, origin}: MetadataProps) {
  const fullUrl =
    origin && metadata['og:url']
      ? new URL(metadata['og:url'], origin).toString()
      : metadata['og:url']

  return (
    <Label
      label="Search Engine Preview"
      className={styles.SearchEnginePreview()}
    >
      <Surface>
        <SurfaceContent style={{gap: '0'}}>
          <div className={styles.SearchEnginePreview.og()}>
            <Button size="icon" icon={IcRoundPublic} />
            <div className={styles.SearchEnginePreview.og.label()}>
              <span>{metadata['og:site_name']}</span>
              <span className={styles.SearchEnginePreview.og.label.small()}>
                {fullUrl}
              </span>
            </div>
          </div>
          <h3 className={styles.SearchEnginePreview.link()}>
            {metadata['title']}
          </h3>
          <p className={styles.SearchEnginePreview.description()}>
            {metadata['description']}
          </p>
        </SurfaceContent>
      </Surface>
    </Label>
  )
}
