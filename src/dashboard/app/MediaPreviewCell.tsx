import {isImage} from '#/core/media/IsImage.js'
import type {OverviewCellProps} from '#/core/Overview.js'
import styler from '@alinea/styler'
import {LucideFile} from '../icons.js'
import css from './MediaPreviewCell.module.css'

const styles = styler(css)

export interface MediaPreviewCellValue {
  preview?: string | null
  averageColor?: string | null
  extension?: string | null
}

/** The preview column of the media library */
export function MediaPreviewCell({
  value
}: OverviewCellProps<MediaPreviewCellValue | undefined>) {
  const preview = value?.preview
  const extension = value?.extension
  if (preview && extension && isImage(extension))
    return (
      <span
        className={styles.MediaPreviewCell()}
        style={{background: value?.averageColor ?? undefined}}
      >
        <img alt="" className={styles.MediaPreviewCell.image()} src={preview} />
      </span>
    )
  return (
    <span className={styles.MediaPreviewCell({file: Boolean(extension)})}>
      {extension && <LucideFile className={styles.MediaPreviewCell.icon()} />}
    </span>
  )
}
