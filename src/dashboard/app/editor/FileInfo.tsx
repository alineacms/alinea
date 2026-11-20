import {
  DataList,
  DataListItem,
  DataListLabel,
  type DataListProps,
  DataListValue,
  Link
} from '#/components.js'
import styler from '@alinea/styler'
import prettyBytes from 'pretty-bytes'
import css from './FileInfo.module.css'

const styles = styler(css)

export interface FileInfoProps {
  orientation?: DataListProps['orientation']
  name?: string
  extension?: string
  size?: number
  /** Shown with the height, for images */
  width?: number
  height?: number
  alt?: string
  location?: string
  /** Opens in a new tab */
  url?: string
  /** Shown for the url, defaults to the url itself */
  urlLabel?: string
}

/** What a media file is: its name, size, dimensions and where it lives */
export function FileInfo({
  orientation,
  name,
  extension,
  size,
  width,
  height,
  alt,
  location,
  url,
  urlLabel = url
}: FileInfoProps) {
  return (
    <DataList
      aria-label="File details"
      className={styles.FileInfo()}
      orientation={orientation}
    >
      {name && (
        <DataListItem>
          <DataListLabel>File name</DataListLabel>
          <DataListValue>{name}</DataListValue>
        </DataListItem>
      )}
      {extension && (
        <DataListItem>
          <DataListLabel>Extension</DataListLabel>
          <DataListValue>{extension}</DataListValue>
        </DataListItem>
      )}
      {size !== undefined && (
        <DataListItem>
          <DataListLabel>File size</DataListLabel>
          <DataListValue>{prettyBytes(size)}</DataListValue>
        </DataListItem>
      )}
      {width && height ? (
        <DataListItem>
          <DataListLabel>Dimensions</DataListLabel>
          <DataListValue>
            {width}px x {height}px
          </DataListValue>
        </DataListItem>
      ) : null}
      {alt !== undefined && (
        <DataListItem>
          <DataListLabel>Alt text</DataListLabel>
          <DataListValue>{alt || 'None'}</DataListValue>
        </DataListItem>
      )}
      {location && (
        <DataListItem>
          <DataListLabel>Location</DataListLabel>
          <DataListValue>{location}</DataListValue>
        </DataListItem>
      )}
      {url && (
        <DataListItem full>
          <DataListLabel>URL</DataListLabel>
          <DataListValue>
            <Link href={url} target="_blank" rel="noopener noreferrer">
              {urlLabel}
            </Link>
          </DataListValue>
        </DataListItem>
      )}
    </DataList>
  )
}
