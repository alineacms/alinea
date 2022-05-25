import {Entry} from '@alinea/core/Entry'
import {Hub} from '@alinea/core/Hub'
import {createId} from '@alinea/core/Id'
import {Media} from '@alinea/core/Media'
import {Outcome} from '@alinea/core/Outcome'
import {encode} from 'blurhash'
import FastAverageColor from 'fast-average-color'
import pLimit from 'p-limit'
import {useState} from 'react'
import {useQueryClient} from 'react-query'
import {useSession} from './UseSession'

const enum UploadStatus {
  Queued,
  CreatingPreview,
  PickingColor,
  BlurHashing,
  Uploading,
  Done
}

type Destination = Pick<Entry, 'id' | 'workspace' | 'root' | 'url' | 'title'>

type Upload = {
  id: string
  file: File
  to: Destination
  status: UploadStatus
  preview?: string
  averageColor?: string
  blurHash?: string
  width?: number
  height?: number
  result?: Media.File
}

function blobUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, _) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (...args) => reject(args)
    img.src = src
  })
}

function getImageData(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')!
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, image.width, image.height)
}

const defaultTasker = pLimit(Infinity)
const cpuTasker = pLimit(4)
const networkTasker = pLimit(8)

const tasker = {
  [UploadStatus.Queued]: defaultTasker,
  [UploadStatus.CreatingPreview]: cpuTasker,
  [UploadStatus.PickingColor]: cpuTasker,
  [UploadStatus.BlurHashing]: cpuTasker,
  [UploadStatus.Uploading]: networkTasker,
  [UploadStatus.Done]: defaultTasker
}

async function process(upload: Upload, hub: Hub): Promise<Upload> {
  switch (upload.status) {
    case UploadStatus.Queued:
      const isImage = Media.isImage(upload.file.name)
      const next = isImage
        ? UploadStatus.CreatingPreview
        : UploadStatus.Uploading
      return {...upload, status: next}
    case UploadStatus.CreatingPreview:
      const {default: reduce} = await import('image-blob-reduce')
      const blob = await reduce().toBlob(upload.file, {
        max: 160,
        unsharpAmount: 160,
        unsharpRadius: 0.6,
        unsharpThreshold: 1
      })
      return {
        ...upload,
        preview: await blobUrl(blob),
        status: UploadStatus.PickingColor
      }
    case UploadStatus.PickingColor:
      const fac = new FastAverageColor()
      const res = await fac.getColorAsync(upload.preview!)
      return {
        ...upload,
        averageColor: res.hex,
        status: UploadStatus.BlurHashing
      }
    case UploadStatus.BlurHashing: {
      const image = await loadImage(upload.preview!)
      const imageData = getImageData(image)
      const blurHash = encode(
        imageData.data,
        imageData.width,
        imageData.height,
        4,
        4
      )
      return {
        ...upload,
        blurHash,
        width: imageData.width,
        height: imageData.height,
        status: UploadStatus.Uploading
      }
    }
    case UploadStatus.Uploading: {
      const {to, file, preview, averageColor, blurHash, width, height} = upload
      const buffer = await file.arrayBuffer()
      const path = (to.url === '/' ? '' : to.url) + '/' + file.name
      const result = await hub
        .uploadFile(to.workspace, to.root, {
          path,
          buffer,
          preview,
          averageColor,
          blurHash,
          width,
          height
        })
        .then(Outcome.unpack)
      return {...upload, result, status: UploadStatus.Done}
    }
    case UploadStatus.Done:
      throw 'assert'
  }
}

export function useUploads(onSelect: (entry: Entry.Minimal) => void) {
  const {hub} = useSession()
  const [uploads, setUploads] = useState<Array<Upload>>([])
  const queryClient = useQueryClient()

  async function uploadFile(file: File, to: Destination) {
    let upload = {id: createId(), file, to, status: UploadStatus.Queued}
    function update(upload: Upload) {
      setUploads(current => {
        const index = current.findIndex(u => u.id === upload.id)
        if (index === -1) return current.concat(upload)
        const result = current.slice()
        result[index] = upload
        return result
      })
    }
    while (true) {
      const next = await tasker[upload.status](() => process(upload, hub))
      update(next)
      if (next.status === UploadStatus.Done) {
        queryClient.invalidateQueries('explorer')
        onSelect(next.result!)
        break
      } else {
        upload = next
      }
    }
  }

  async function upload(files: FileList, to: Destination) {
    return Promise.all(Array.from(files).map(file => uploadFile(file, to)))
  }

  return {upload, uploads}
}
