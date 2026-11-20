import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
  Link,
  MediaPreview
} from '#/components.js'
import {Config} from '#/core/Config.js'
import {isImage} from '#/core/media/IsImage.js'
import {hasPreviewImage} from '#/core/media/Pdf.js'
import {base64} from '#/core/util/Encoding.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import type {LinkEntrySummary} from '#/dashboard/atoms/link.js'
import styler from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import prettyBytes from 'pretty-bytes'
import {thumbHashToDataURL} from 'thumbhash'
import css from './LinkDetails.module.css'

const styles = styler(css)

const openableProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/** The absolute url of a link, unless it would run script like javascript: */
export function openableUrl(
  url: string | undefined,
  base: string
): string | undefined {
  if (!url) return undefined
  const parsed = URL.parse(url, base)
  return parsed && openableProtocols.has(parsed.protocol)
    ? parsed.href
    : undefined
}

export interface LinkDetailsProps {
  /** Where the link points, relative urls resolve on the site */
  url?: string
  /** The linked entry, once it is resolved */
  entry?: LinkEntrySummary
}

/** What a link points to: its url and, for files, a preview and metadata */
export function LinkDetails({url, entry}: LinkDetailsProps) {
  const config = useAtomValueRaw(configAtom)
  const href = openableUrl(url, Config.baseUrl(config) ?? window.location.href)
  const file = entry?.file
  if (!href && !file) return null
  return (
    <div className={styles.LinkDetails()}>
      {entry && file && <LinkFilePreview entry={entry} />}
      <DataList aria-label="Link details">
        {entry && file && <LinkFileDetails entry={entry} />}
        {href && (
          <DataListItem>
            <DataListLabel>URL</DataListLabel>
            <DataListValue>
              <Link href={href} target="_blank" rel="noreferrer">
                {href}
              </Link>
            </DataListValue>
          </DataListItem>
        )}
      </DataList>
    </div>
  )
}

interface LinkFileProps {
  entry: LinkEntrySummary
}

function LinkFilePreview({entry}: LinkFileProps) {
  const {file, preview} = entry
  const extension = file?.extension ?? ''
  if (!file || !preview) return null
  if (!isImage(extension) && !hasPreviewImage(extension)) return null
  return (
    <MediaPreview
      className={styles.LinkDetails.preview()}
      src={preview}
      placeholder={
        file.thumbHash
          ? thumbHashToDataURL(base64.parse(file.thumbHash))
          : undefined
      }
      averageColor={file.averageColor}
      width={file.width}
      height={file.height}
      alt={file.alt ?? ''}
    />
  )
}

function LinkFileDetails({entry}: LinkFileProps) {
  const {file} = entry
  if (!file) return null
  const image = Boolean(file.extension && isImage(file.extension))
  const location = [entry.rootLabel, ...entry.parents.map(p => p.title)]
    .filter(Boolean)
    .join(' / ')
  return (
    <>
      <DataListItem>
        <DataListLabel>Title</DataListLabel>
        <DataListValue>{entry.title}</DataListValue>
      </DataListItem>
      {file.name && (
        <DataListItem>
          <DataListLabel>File name</DataListLabel>
          <DataListValue>{file.name}</DataListValue>
        </DataListItem>
      )}
      {file.extension && (
        <DataListItem>
          <DataListLabel>Extension</DataListLabel>
          <DataListValue>{file.extension}</DataListValue>
        </DataListItem>
      )}
      {file.size !== undefined && (
        <DataListItem>
          <DataListLabel>File size</DataListLabel>
          <DataListValue>{prettyBytes(file.size)}</DataListValue>
        </DataListItem>
      )}
      {image && file.width && file.height ? (
        <DataListItem>
          <DataListLabel>Dimensions</DataListLabel>
          <DataListValue>
            {file.width}px x {file.height}px
          </DataListValue>
        </DataListItem>
      ) : null}
      {image && (
        <DataListItem>
          <DataListLabel>Alt text</DataListLabel>
          <DataListValue>{file.alt ?? 'None'}</DataListValue>
        </DataListItem>
      )}
      {location && (
        <DataListItem>
          <DataListLabel>Location</DataListLabel>
          <DataListValue>{location}</DataListValue>
        </DataListItem>
      )}
    </>
  )
}
