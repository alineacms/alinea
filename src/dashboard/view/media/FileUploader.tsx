import {Entry} from 'alinea/core/Entry'
import {MediaLibrary} from 'alinea/core/media/MediaSchema'
import {Outcome} from 'alinea/core/Outcome'
import {InputField} from 'alinea/editor/view/InputField'
import {select} from 'alinea/input/select'
import {fromModule, px, Typo, VStack} from 'alinea/ui'
import {IcRoundUploadFile} from 'alinea/ui/icons/IcRoundUploadFile'
import {ChangeEvent, DragEvent, useRef, useState} from 'react'
import {useQuery} from 'react-query'
import {useSession} from '../../hook/UseSession.js'
import {useUploads} from '../../hook/UseUploads.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import {FileSummaryRow} from './FileSummary.js'
import css from './FileUploader.module.scss'

const styles = fromModule(css)

type FileUploaderProps = {
  max?: number
  toggleSelect: (id: Entry) => void
}

export function FileUploader({max, toggleSelect}: FileUploaderProps) {
  const {cnx: hub} = useSession()
  const {name: workspace} = useWorkspace()
  const {upload, uploads} = useUploads(toggleSelect)
  const dropZone = useRef<HTMLDivElement>(null)
  const [isOver, setIsOver] = useState(false)
  const {data: libraries = []} = useQuery(
    ['media-libraries', workspace],
    () => {
      return hub
        .query({
          cursor: MediaLibrary.where(Page.workspace.is(workspace)).select({
            id: MediaLibrary.id,
            title: MediaLibrary.title,
            workspace: MediaLibrary.alinea.workspace,
            root: MediaLibrary.alinea.root,
            url: MediaLibrary.url,
            parents: Tree.parents(MediaLibrary.id).select(parent => ({
              title: parent.title
            }))
          })
        })
        .then(Outcome.unpack)
    }
  )
  const [uploadTo = libraries?.[0]?.id, setUploadTo] = useState<
    string | undefined
  >()
  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    setIsOver(true)
  }
  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.target !== dropZone.current) return
    if (dropZone.current!.contains(event.relatedTarget as HTMLElement)) return
    setIsOver(false)
  }
  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
  }
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const files = event.dataTransfer.files
    setIsOver(false)
    uploadFiles(files)
  }
  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const {files} = event.target
    if (files) uploadFiles(files)
  }
  function uploadFiles(files: FileList) {
    const mediaLibraryMediaLibrary = libraries?.find(l => l.id === uploadTo)
    if (mediaLibraryMediaLibrary) upload(files, mediaLibraryMediaLibrary)
  }
  return (
    <VStack
      ref={dropZone}
      className={styles.root({over: isOver})}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className={styles.root.uploads()}>
        {uploads.map(upload => {
          const mediaLibrary = libraries?.find(l => l.id === upload.to.id)
          // Todo: show upload progress
          return (
            <FileSummaryRow
              key={upload.id}
              id={upload.id}
              title={upload.file.name}
              extension={upload.file.name.split('.').pop()!}
              size={upload.file.size}
              workspace={upload.to.workspace}
              root={upload.to.root}
              preview={upload.preview!}
              averageColor={upload.averageColor!}
              parents={mediaLibrary!.parents.concat(mediaLibrary!)}
            />
          )
        })}
      </div>
      <VStack center className={styles.root.desc()}>
        <IcRoundUploadFile style={{fontSize: px(30)}} />
        <Typo.P as="label" className={styles.root.desc.label()}>
          <input
            type="file"
            className={styles.root.desc.label.input()}
            multiple={max !== 1}
            onChange={handleFileInput}
          />
          <Typo.Link className={styles.root.desc.label.link()}>
            Browse files
          </Typo.Link>{' '}
          or drag and drop to start uploading
        </Typo.P>
      </VStack>
      <footer className={styles.root.footer()}>
        <InputField
          value={uploadTo}
          onChange={setUploadTo}
          field={select(
            'Upload to',
            Object.fromEntries(
              libraries!.map(mediaLibrary => {
                return [mediaLibrary.id, mediaLibrary.title as string]
              })
            )
          )}
        />
      </footer>
    </VStack>
  )
}
