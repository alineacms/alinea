import {Media} from 'alinea/backend/Media'
import {Connection, EntryRow} from 'alinea/core'
import {createId} from 'alinea/core/Id'
import {MutationType} from 'alinea/core/Mutation'
import {base64} from 'alinea/core/util/Encoding'
import {imageBlurUrl} from 'alinea/ui'
import {rgba, toHex} from 'color2k'
import pLimit from 'p-limit'
import {useState} from 'react'
import {rgbaToThumbHash, thumbHashToAverageRGBA} from 'thumbhash'
import {addPending} from '../atoms/PendingAtoms.js'
import {useSession} from './UseSession.js'

export enum UploadStatus {
  Queued,
  CreatingPreview,
  Uploading,
  Done
}

export interface UploadDestination {
  parentId?: string
  workspace: string
  root: string
}

type Upload = {
  id: string
  file: File
  to: UploadDestination
  status: UploadStatus
  preview?: string
  averageColor?: string
  thumbHash?: string
  width?: number
  height?: number
  result?: Media.File
}

const defaultTasker = pLimit(Infinity)
const cpuTasker = pLimit(4)
const networkTasker = pLimit(8)

const tasker = {
  [UploadStatus.Queued]: defaultTasker,
  [UploadStatus.CreatingPreview]: cpuTasker,
  [UploadStatus.Uploading]: networkTasker,
  [UploadStatus.Done]: defaultTasker
}

async function process(upload: Upload, client: Connection): Promise<Upload> {
  switch (upload.status) {
    case UploadStatus.Queued:
      const isImage = Media.isImage(upload.file.name)
      const next = isImage
        ? UploadStatus.CreatingPreview
        : UploadStatus.Uploading
      return {...upload, status: next}
    case UploadStatus.CreatingPreview: {
      const url = URL.createObjectURL(upload.file)

      // Load the image
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = err => reject(err)
        image.src = url
      }).finally(() => URL.revokeObjectURL(url))

      const size = Math.max(image.width, image.height)

      // Scale the image to 100x100 maximum size
      const thumbW = Math.round((100 * image.width) / size)
      const thumbH = Math.round((100 * image.height) / size)
      const thumbCanvas = document.createElement('canvas')
      const thumbContext = thumbCanvas.getContext('2d')!
      thumbCanvas.width = thumbW
      thumbCanvas.height = thumbH
      thumbContext.drawImage(image, 0, 0, thumbW, thumbH)

      // Calculate thumbhash
      const pixels = thumbContext.getImageData(0, 0, thumbW, thumbH)
      const thumbHash = rgbaToThumbHash(thumbW, thumbH, pixels.data)

      // Get the average color via thumbhash
      const {r, g, b, a} = thumbHashToAverageRGBA(thumbHash)
      const averageColor = toHex(rgba(r * 255, g * 255, b * 255, a))

      // Create webp preview image
      const previewW = Math.round((160 * image.width) / size)
      const previewH = Math.round((160 * image.height) / size)
      const previewCanvas = document.createElement('canvas')
      const previewContext = previewCanvas.getContext('2d')!
      previewCanvas.width = previewW
      previewCanvas.height = previewH
      previewContext.drawImage(image, 0, 0, previewW, previewH)
      const preview = previewCanvas.toDataURL('image/webp', 1)

      return {
        ...upload,
        preview,
        averageColor,
        thumbHash: base64.stringify(thumbHash),
        width: image.width,
        height: image.height,
        status: UploadStatus.Uploading
      }
    }
    case UploadStatus.Uploading: {
      const {to, file, preview, averageColor, thumbHash, width, height} = upload
      const buffer = await file.arrayBuffer()
      const path = file.name
      const result = await client.uploadFile({
        ...to,
        path,
        buffer,
        preview,
        averageColor,
        thumbHash,
        width,
        height
      })

      return {...upload, result, status: UploadStatus.Done}
    }
    case UploadStatus.Done:
      throw 'assert'
  }
}

export function useUploads(onSelect?: (entry: EntryRow) => void) {
  const {cnx: client} = useSession()
  const [uploads, setUploads] = useState<Array<Upload>>([])

  async function uploadFile(upload: Upload) {
    function update(upload: Upload) {
      setUploads(current => {
        const index = current.findIndex(u => u.id === upload.id)
        if (index === -1) throw new Error('assert')
        const result = current.slice()
        result[index] = upload
        return result
      })
    }
    while (true) {
      const next = await tasker[upload.status](() => process(upload, client))
      update(next)
      if (next.status === UploadStatus.Done) {
        const entry = next.result! as Media.Image
        const hashThumbHash = Boolean(entry.data.thumbHash)
        if (hashThumbHash) {
          const previewSrc = imageBlurUrl(entry.data)!
          entry.data.preview = previewSrc
          entry.data.location = previewSrc
        }
        addPending({
          type: MutationType.FileUpload,
          entryId: entry.entryId,
          file: entry.filePath,
          entry: entry
        })
        onSelect?.(entry)
        break
      } else {
        upload = next
      }
    }
  }

  async function upload(files: FileList, to: UploadDestination) {
    const uploads = Array.from(files).map(file => {
      return {id: createId(), file, to, status: UploadStatus.Queued}
    })
    setUploads(current => [...uploads, ...current])
    return Promise.all(uploads.map(uploadFile))
  }

  return {upload, uploads}
}
