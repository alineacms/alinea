import type {UploadResponse} from 'alinea/core/Connection'
import {Entry} from 'alinea/core/Entry'
import type {EntryRow} from 'alinea/core/EntryRow'
import {UploadOperation} from 'alinea/core/db/Operation'
import {createPreview} from 'alinea/core/media/CreatePreview'
import {MediaFile} from 'alinea/core/media/MediaTypes'
import {useAtomValue} from 'jotai'
import {useState} from 'react'
import {dbAtom} from '../atoms/DbAtoms.js'

export enum UploadStatus {
  Queued,
  CreatingPreview,
  Uploading,
  Uploaded,
  Done
}

export interface UploadDestination {
  // Use to overwrite files
  entryId?: string
  parentId?: string
  workspace: string
  root: string
  directory: string
}

export interface Upload {
  id: string
  file: File
  to: UploadDestination
  status: UploadStatus
  info?: UploadResponse
  preview?: string
  averageColor?: string
  focus?: {x: number; y: number}
  thumbHash?: string
  width?: number
  height?: number
  result?: EntryRow<MediaFile>
  error?: Error
  replace?: {entry: EntryRow; entryFile: string}
}

export function useUploads(onSelect?: (entry: EntryRow) => void) {
  const db = useAtomValue(dbAtom)
  const [uploads, setUploads] = useState(Array<Upload>)

  async function upload(
    files: Array<File>,
    to: UploadDestination,
    replaceId?: string
  ) {
    const ops = Array.from(
      files,
      file =>
        new UploadOperation({
          file,
          createPreview,
          parentId: to.parentId,
          workspace: to.workspace,
          root: to.root,
          replaceId: replaceId
        })
    )
    const ids = ops.map(_ => _.id)
    const uploads: Array<Upload> = ops.map((op, index) => {
      return {
        id: op.id,
        file: files[index],
        to,
        replaceId,
        status: UploadStatus.Queued
      }
    })
    setUploads(current => [...uploads, ...current])
    try {
      await db.commit(...ops)
      const files = await db.find({
        select: {
          ...Entry,
          ...MediaFile
        },
        type: MediaFile,
        id: {in: ids}
      })
      setUploads(current =>
        current.map((upload): Upload => {
          const entry = files.find(file => file.id === upload.id)
          if (!entry) return upload
          const result = {
            ...upload,
            status: UploadStatus.Done,
            preview: entry.preview,
            averageColor: entry.averageColor,
            focus: entry.focus,
            thumbHash: entry.thumbHash,
            width: entry.width,
            height: entry.height
          }
          onSelect?.(entry)
          return result
        })
      )
    } catch (error) {
      setUploads(current =>
        current.map((upload): Upload => {
          if (ids.includes(upload.id))
            return {...upload, status: UploadStatus.Done, error: error as Error}
          return upload
        })
      )
    }
  }

  return {upload, uploads}
}
