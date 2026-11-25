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
import {FileInfo} from '#/dashboard/app/editor/FileInfo.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import type {LinkEntrySummary} from '#/dashboard/atoms/link.js'
import {imageBlurUrl} from '#/ui/util/ImageBlurUrl.js'
import styler from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import css from './LinkDetails.module.css'
import {openableUrl} from './LinkUrl.js'

const styles = styler(css)

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
  if (entry?.file) return <LinkFileDetails entry={entry} href={href} />
  if (!href) return null
  return (
    <DataList aria-label="Link details">
      <DataListItem>
        <DataListLabel>URL</DataListLabel>
        <DataListValue>
          <Link href={href} target="_blank" rel="noopener noreferrer">
            {href}
          </Link>
        </DataListValue>
      </DataListItem>
    </DataList>
  )
}

interface LinkFileDetailsProps {
  entry: LinkEntrySummary
  href?: string
}

function LinkFileDetails({entry, href}: LinkFileDetailsProps) {
  const {file, preview} = entry
  if (!file) return null
  const extension = file.extension ?? ''
  const image = Boolean(isImage(extension))
  return (
    <div className={styles.LinkDetails()}>
      {preview && hasPreviewImage(extension) && (
        <MediaPreview
          className={styles.LinkDetails.preview()}
          src={preview}
          placeholder={imageBlurUrl(file) || undefined}
          averageColor={file.averageColor}
          width={file.width}
          height={file.height}
          alt={file.alt ?? ''}
        />
      )}
      <FileInfo
        name={file.name}
        size={file.size}
        width={image ? file.width : undefined}
        height={image ? file.height : undefined}
        alt={image ? (file.alt ?? '') : undefined}
        url={href}
      />
    </div>
  )
}
