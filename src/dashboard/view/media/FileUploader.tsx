import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import {HStack, Icon, VStack} from 'alinea/ui'
import {IcOutlineCloudUpload} from 'alinea/ui/icons/IcOutlineCloudUpload'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowUp} from 'alinea/ui/icons/IcRoundKeyboardArrowUp'
import {ChangeEvent, useEffect, useState} from 'react'
import {
  UploadDestination,
  UploadStatus,
  useUploads
} from '../../hook/UseUploads.js'
import {FileUploadRow} from './FileUploadRow.js'
import css from './FileUploader.module.scss'

const styles = styler(css)

export interface FileUploaderProps {
  onlyImages?: boolean
  destination?: UploadDestination
  max?: number
  toggleSelect?: (id: Entry) => void
  position?: 'left' | 'right'
}

export function FileUploader({
  onlyImages,
  destination,
  max,
  toggleSelect,
  position = 'right'
}: FileUploaderProps) {
  const readOnly = !destination
  const {upload, uploads} = useUploads(toggleSelect)
  const [isOver, setIsOver] = useState(false)
  const isUploading = uploads.length > 0
  const uploadsDone = uploads.filter(
    upload => upload.status === UploadStatus.Done
  ).length
  const isFinished = uploadsDone === uploads.length
  const todo = uploads.length - uploadsDone
  const [showUploads, setShowUploads] = useState(true)
  function uploadFiles(files: FileList) {
    if (readOnly) return
    return upload([...files], destination)
  }
  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const {files} = event.target
    if (files) return uploadFiles(files)
  }
  const description = isUploading
    ? isFinished
      ? `${uploadsDone} upload${uploadsDone > 1 ? 's' : ''} complete`
      : `uploading ${todo} file${todo > 1 ? 's' : ''}`
    : 'Upload files'
  useEffect(() => {
    const {body} = document
    let eventTarget: EventTarget | null
    function handleDragEnter(event: DragEvent) {
      eventTarget = event.target
      setIsOver(true)
    }
    function handleDragOver(event: DragEvent) {
      event.preventDefault()
    }
    function handleDragLeave(event: DragEvent) {
      if (event.target === eventTarget) setIsOver(false)
    }
    function handleDrop(event: DragEvent) {
      event.preventDefault()
      setIsOver(false)
      const files = event.dataTransfer?.files
      if (files) uploadFiles(files)
    }
    body.addEventListener('dragenter', handleDragEnter)
    body.addEventListener('dragover', handleDragOver)
    body.addEventListener('dragleave', handleDragLeave)
    body.addEventListener('drop', handleDrop)
    return () => {
      body.removeEventListener('dragenter', handleDragEnter)
      body.removeEventListener('dragover', handleDragOver)
      body.removeEventListener('dragleave', handleDragLeave)
      body.removeEventListener('drop', handleDrop)
    }
  }, [destination])
  return (
    <div
      className={styles.root({over: isOver})}
      style={{
        [position]: 0
      }}
    >
      <VStack className={styles.root.content()}>
        <HStack as="header" className={styles.root.header()}>
          <label className={styles.root.header.label()}>
            {!readOnly && (
              <input
                type="file"
                className={styles.root.header.label.input()}
                multiple={max !== 1}
                onChange={handleFileInput}
                accept={
                  onlyImages
                    ? 'image/jpeg, image/png, image/gif, image/webp, image/avif, image/heic, image/svg+xml'
                    : undefined
                }
              />
            )}
            <HStack center gap={8}>
              <Icon icon={IcOutlineCloudUpload} size={17} />
              <span>{description}</span>
            </HStack>
          </label>

          {isUploading && (
            <button
              onClick={() => setShowUploads(!showUploads)}
              className={styles.root.header.close()}
            >
              <Icon
                icon={
                  showUploads
                    ? IcRoundKeyboardArrowDown
                    : IcRoundKeyboardArrowUp
                }
                size={18}
              />
            </button>
          )}
        </HStack>

        {showUploads && (
          <div className={styles.root.uploads()}>
            {uploads.map(upload => {
              return (
                <div key={upload.id} className={styles.root.uploads.row()}>
                  <FileUploadRow {...upload} />
                </div>
              )
            })}
          </div>
        )}
      </VStack>
    </div>
  )
}
