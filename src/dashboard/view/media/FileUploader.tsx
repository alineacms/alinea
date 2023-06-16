import {Page} from 'alinea/core'
import {Entry} from 'alinea/core/Entry'
import {MediaLibrary} from 'alinea/core/media/MediaSchema'
import {InputField} from 'alinea/editor/view/InputField'
import {select} from 'alinea/input/select'
import {Typo, VStack, fromModule, px} from 'alinea/ui'
import {IcRoundUploadFile} from 'alinea/ui/icons/IcRoundUploadFile'
import {useAtomValue} from 'jotai'
import {ChangeEvent, DragEvent, useRef, useState} from 'react'
import {useQuery} from 'react-query'
import {graphAtom} from '../../atoms/EntryAtoms.js'
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
  const {name: workspace} = useWorkspace()
  const {upload, uploads} = useUploads(toggleSelect)
  const dropZone = useRef<HTMLDivElement>(null)
  const [isOver, setIsOver] = useState(false)
  const graph = useAtomValue(graphAtom)
  const {data: libraries = []} = useQuery(
    ['media-libraries', workspace],
    () => {
      return graph.active.find(
        MediaLibrary()
          .where(Page.workspace.is(workspace))
          .select({
            id: Page.entryId,
            title: MediaLibrary.title,
            workspace: Page.workspace,
            root: Page.root,
            url: Page.url,
            parents({parents}) {
              return parents().select({
                entryId: Page.entryId,
                title: Page.title
              })
            }
          })
      )
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
              entryId={upload.id}
              type={'MediaLibrary'}
              title={upload.file.name}
              extension={upload.file.name.split('.').pop()!}
              size={upload.file.size}
              workspace={upload.to.workspace}
              root={upload.to.root}
              preview={upload.preview!}
              averageColor={upload.averageColor!}
              parents={mediaLibrary!.parents.concat({
                entryId: mediaLibrary!.id,
                title: mediaLibrary!.title
              })}
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
