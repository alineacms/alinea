import {Icon} from '#/components.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {isImage} from '#/core/media/IsImage.js'
import {type Infer} from '#/types.js'
import styler from '@alinea/styler'
import prettyBytes from 'pretty-bytes'
import type {ReactNode} from 'react'
import {IcRoundInsertDriveFile} from '../icons.js'
import css from './ExplorerFileCard.module.css'

const styles = styler(css)

export interface ExplorerFileCardProps {
  file: Infer<typeof MediaFile>
  label: string
  layout: 'card' | 'row'
  parents?: ReactNode
}

export function ExplorerFileCard({
  file,
  label,
  layout,
  parents
}: ExplorerFileCardProps) {
  const extension = formatExtension(file.extension)
  const isImageFile = Boolean(file.extension && isImage(file.extension))
  const preview = isImageFile ? file.preview : undefined
  const details = formatFileDetails(file)

  return (
    <div className={styles.ExplorerFileCard(layout, {image: Boolean(preview)})}>
      <div className={styles.ExplorerFileCard.top()}>
        <div
          className={styles.ExplorerFileCard.preview()}
          style={{
            backgroundColor: file.averageColor || undefined
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt=""
              className={styles.ExplorerFileCard.preview.image()}
            />
          ) : (
            <div className={styles.ExplorerFileCard.preview.placeholder()}>
              <Icon
                icon={IcRoundInsertDriveFile}
                className={styles.ExplorerFileCard.preview.placeholder.icon()}
              />
            </div>
          )}
        </div>
      </div>

      <div className={styles.ExplorerFileCard.body()}>
        <div className={styles.ExplorerFileCard.body.inner()}>
          {parents}
          <div className={styles.ExplorerFileCard.label()}>{label}</div>
          <div className={styles.ExplorerFileCard.meta()}>
            {extension && (
              <span className={styles.ExplorerFileCard.meta.extension()}>
                {extension}
              </span>
            )}
            {details && (
              <span className={styles.ExplorerFileCard.meta.details()}>
                {details}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatExtension(extension?: string) {
  if (!extension) return ''
  return extension.replace(/^\./, '').toUpperCase()
}

function formatFileDetails(file: Infer<typeof MediaFile>) {
  const details = new Array<string>()
  if (file.width && file.height) details.push(`${file.width}x${file.height}`)
  if (typeof file.size === 'number') details.push(prettyBytes(file.size))
  return details.join(' ')
}
