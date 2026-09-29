import {Button, Icon, Text, ToggleGroup, ToggleGroupItem} from '#/components.js'
import {rotatedSize, type ImageEdit} from '#/core/media/ImageTransform.js'
import type {
  ImageSize,
  PendingUpload,
  PendingUploadAction,
  PendingUploads
} from '#/dashboard/atoms/upload.js'
import styler from '@alinea/styler'
import {extname} from '#/core/util/Paths.js'
import prettyBytes from 'pretty-bytes'
import {useState} from 'react'
import {IcRoundClose, IcRoundCrop, IcRoundInfo} from '../icons.js'
import {CroppedImage} from './CroppedImage.js'
import {fileKindVisual} from './FileKind.js'
import {ImageEditor} from './ImageEditor.js'
import css from './PendingUploadsView.module.css'
import {
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const styles = styler(css)

export interface PendingUploadChange {
  action?: PendingUploadAction
  edit?: ImageEdit
}

export interface PendingUploadsViewProps {
  pending: PendingUploads
  onChange(id: string, change: PendingUploadChange): void
  onRemove(id: string): void
  onCancel(): void
  onConfirm(): void
}

/**
 * The files about to be uploaded: images can be edited first, files that
 * exist already can be used instead or replaced
 */
export function PendingUploadsView({
  pending,
  onChange,
  onRemove,
  onCancel,
  onConfirm
}: PendingUploadsViewProps) {
  const [editing, setEditing] = useState<string>()
  const editingUpload = pending.uploads.find(upload => upload.id === editing)
  if (editingUpload?.previewUrl && editingUpload.imageSize) {
    const {previewUrl, imageSize} = editingUpload
    return (
      <DashboardModalDialog label={`Edit ${editingUpload.file.name}`}>
        <DashboardModalContent>
          <ImageEditor
            src={previewUrl}
            width={imageSize.width}
            height={imageSize.height}
            edit={editingUpload.edit}
            onApply={edit => {
              onChange(editingUpload.id, {edit})
              setEditing(undefined)
            }}
            onCancel={() => setEditing(undefined)}
          />
        </DashboardModalContent>
      </DashboardModalDialog>
    )
  }
  const {replace, uploads} = pending
  const uploading = uploads.filter(upload => upload.action !== 'existing')
  const label = replace
    ? `Replace ${replace.title}`
    : `Upload ${formatCount(uploads.length)}`
  const confirmLabel = replace
    ? 'Replace file'
    : uploading.length === 0
      ? uploads.length === 1
        ? 'Use existing file'
        : 'Use existing files'
      : `Upload ${formatCount(uploading.length)}`
  return (
    <DashboardModalDialog label={label}>
      <DashboardModalContent>
        <ul className={styles.PendingUploadsView()} aria-label="Files">
          {uploads.map(upload => (
            <PendingUploadRow
              key={upload.id}
              upload={upload}
              replacing={Boolean(replace)}
              onChange={change => onChange(upload.id, change)}
              onEdit={() => setEditing(upload.id)}
              onRemove={() => onRemove(upload.id)}
            />
          ))}
        </ul>
      </DashboardModalContent>
      <DashboardModalFooter>
        <Button variant="outline" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button color="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DashboardModalFooter>
    </DashboardModalDialog>
  )
}

interface PendingUploadRowProps {
  upload: PendingUpload
  replacing: boolean
  onChange(change: PendingUploadChange): void
  onEdit(): void
  onRemove(): void
}

function PendingUploadRow({
  upload,
  replacing,
  onChange,
  onEdit,
  onRemove
}: PendingUploadRowProps) {
  const {file, duplicate, conflict, action, edit, imageSize} = upload
  const canEdit = imageSize && action !== 'existing'
  const hasChoice = !replacing && (duplicate || conflict)
  return (
    <li className={styles.PendingUploadsView.row()}>
      <PendingUploadThumbnail upload={upload} />
      <div className={styles.PendingUploadsView.row.info()}>
        <Text as="span" weight="medium" truncate>
          {file.name}
        </Text>
        <Text as="span" size="sm" color="muted">
          {prettyBytes(file.size)}
          {edit && ' · Edited'}
        </Text>
        {!replacing && duplicate && (
          <Text
            as="p"
            size="sm"
            className={styles.PendingUploadsView.row.notice()}
          >
            <Icon icon={IcRoundInfo} />
            Already in the media library as “{duplicate.title}”
          </Text>
        )}
        {!replacing && conflict && !duplicate && (
          <Text
            as="p"
            size="sm"
            className={styles.PendingUploadsView.row.notice()}
          >
            <Icon icon={IcRoundInfo} />A file named “{conflict.title}” exists in
            this folder
          </Text>
        )}
        {hasChoice && (
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            aria-label={`What to do with ${file.name}`}
            value={action}
            onValueChange={value => {
              if (value) onChange({action: value as PendingUploadAction})
            }}
            className={styles.PendingUploadsView.row.choice()}
          >
            {duplicate && (
              <ToggleGroupItem value="existing">Use existing</ToggleGroupItem>
            )}
            {conflict && (
              <ToggleGroupItem value="replace">Replace</ToggleGroupItem>
            )}
            <ToggleGroupItem value="upload">
              {conflict ? 'Keep both' : 'Upload anyway'}
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
      <div className={styles.PendingUploadsView.row.actions()}>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon-sm"
            icon={IcRoundCrop}
            aria-label={`Edit ${file.name}`}
            onClick={onEdit}
          />
        )}
        {!replacing && (
          <Button
            variant="ghost"
            size="icon-sm"
            icon={IcRoundClose}
            aria-label={`Remove ${file.name}`}
            onClick={onRemove}
          />
        )}
      </div>
    </li>
  )
}

interface PendingUploadThumbnailProps {
  upload: PendingUpload
}

function PendingUploadThumbnail({upload}: PendingUploadThumbnailProps) {
  const {previewUrl, imageSize, edit} = upload
  if (previewUrl && imageSize && edit) {
    const rotated = rotatedSize(imageSize.width, imageSize.height, edit.rotate)
    const crop = edit.crop ?? {width: 1, height: 1}
    const landscape = crop.width * rotated.width >= crop.height * rotated.height
    return (
      <span className={styles.PendingUploadsView.row.thumbnail()}>
        <CroppedImage
          src={previewUrl}
          width={imageSize.width}
          height={imageSize.height}
          edit={edit}
          // Fit the thumbnail, the image keeps its ratio
          style={landscape ? {width: '100%'} : {height: '100%'}}
        />
      </span>
    )
  }
  if (previewUrl)
    return (
      <span className={styles.PendingUploadsView.row.thumbnail()}>
        <img
          alt=""
          src={previewUrl}
          className={styles.PendingUploadsView.row.thumbnail.image()}
        />
      </span>
    )
  const {icon, color} = fileKindVisual(extname(upload.file.name))
  return (
    <span
      className={styles.PendingUploadsView.row.thumbnail()}
      style={{background: color}}
    >
      <Icon
        icon={icon}
        className={styles.PendingUploadsView.row.thumbnail.icon()}
      />
    </span>
  )
}

function formatCount(count: number) {
  return `${count} ${count === 1 ? 'file' : 'files'}`
}
