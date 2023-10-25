import '@ungap/with-resolvers'
import {Media} from 'alinea/backend/Media'
import {createContentHash} from 'alinea/backend/util/ContentHash'
import {
  Connection,
  Entry,
  EntryPhase,
  EntryRow,
  HttpError,
  Workspace
} from 'alinea/core'
import {entryFileName, entryFilepath} from 'alinea/core/EntryFilenames'
import {createId} from 'alinea/core/Id'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {base64} from 'alinea/core/util/Encoding'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {
  basename,
  dirname,
  extname,
  join,
  normalize
} from 'alinea/core/util/Paths'
import {rgba, toHex} from 'color2k'
import {useSetAtom} from 'jotai'
import pLimit from 'p-limit'
import {useState} from 'react'
import smartcrop from 'smartcrop'
import {rgbaToThumbHash, thumbHashToAverageRGBA} from 'thumbhash'
import {useMutate} from '../atoms/DbAtoms.js'
import {errorAtom} from '../atoms/ErrorAtoms.js'
import {useConfig} from './UseConfig.js'
import {useGraph} from './UseGraph.js'
import {useSession} from './UseSession.js'

export enum UploadStatus {
  Queued,
  CreatingPreview,
  Uploading,
  Uploaded,
  Done
}

export interface UploadDestination {
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
  info?: Connection.UploadResponse
  preview?: string
  averageColor?: string
  focus?: {x: number; y: number}
  thumbHash?: string
  width?: number
  height?: number
  result?: Media.File
  error?: Error
}

const defaultTasker = pLimit(Infinity)
const cpuTasker = pLimit(1)
const networkTasker = pLimit(8)
const batchTasker = pLimit(1)

const tasker = {
  [UploadStatus.Queued]: defaultTasker,
  [UploadStatus.CreatingPreview]: cpuTasker,
  [UploadStatus.Uploading]: networkTasker,
  [UploadStatus.Uploaded]: defaultTasker,
  [UploadStatus.Done]: defaultTasker
}

async function process(
  upload: Upload,
  createEntry: (upload: Upload) => Promise<{
    file: string
    entry: Media.File
  }>,
  client: Connection,
  mutate: (...mutations: Array<Mutation>) => Promise<void>
): Promise<Upload> {
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
      const previewW = Math.min(
        Math.round((160 * image.width) / size),
        image.width
      )
      const previewH = Math.min(
        Math.round((160 * image.height) / size),
        image.height
      )
      const previewCanvas = document.createElement('canvas')
      const previewContext = previewCanvas.getContext('2d')!
      previewContext.imageSmoothingEnabled = true
      previewContext.imageSmoothingQuality = 'high'
      previewCanvas.width = previewW
      previewCanvas.height = previewH
      previewContext.drawImage(image, 0, 0, previewW, previewH)
      const preview = previewCanvas.toDataURL('image/webp')

      const crop = await smartcrop.crop(image, {width: 100, height: 100})
      const focus = {
        x: (crop.topCrop.x + crop.topCrop.width / 2) / image.width,
        y: (crop.topCrop.y + crop.topCrop.height / 2) / image.height
      }

      return {
        ...upload,
        preview,
        averageColor,
        focus,
        thumbHash: base64.stringify(thumbHash),
        width: image.naturalWidth,
        height: image.naturalHeight,
        status: UploadStatus.Uploading
      }
    }
    case UploadStatus.Uploading: {
      const fileName = upload.file.name
      const file = join(upload.to.directory, fileName)
      const info = await client.prepareUpload(file)
      await fetch(info.upload.url, {
        method: info.upload.method ?? 'POST',
        body: upload.file
      }).then(async result => {
        if (!result.ok)
          throw new HttpError(
            result.status,
            `Could not reach server for upload`
          )
      })
      return {...upload, info, status: UploadStatus.Uploaded}
    }
    case UploadStatus.Uploaded: {
      const {file, entry} = await createEntry(upload)
      const info = upload.info!
      await mutate(
        {
          type: MutationType.Create,
          entryId: entry.entryId,
          file,
          entry
        },
        {
          type: MutationType.Upload,
          entryId: entry.entryId,
          url: info.previewUrl,
          file: info.location
        }
      )
      return {...upload, result: entry, status: UploadStatus.Done}
    }
    case UploadStatus.Done:
      throw new Error('Should not end up here')
  }
}

function createBatch(mutate: (...mutations: Array<Mutation>) => Promise<void>) {
  let trigger = Promise.withResolvers()
  let nextRun: any = undefined
  const batch = [] as Array<Mutation>
  async function run() {
    const todo = batch.splice(0, batch.length)
    try {
      await batchTasker(() => mutate(...todo))
      trigger.resolve(void 0)
    } catch (error) {
      trigger.reject(error)
    } finally {
      trigger = Promise.withResolvers()
    }
  }
  return (...mutations: Array<Mutation>) => {
    batch.push(...mutations)
    clearTimeout(nextRun)
    nextRun = setTimeout(run, 200)
    return trigger.promise
  }
}

export function useUploads(onSelect?: (entry: EntryRow) => void) {
  const config = useConfig()
  const graph = useGraph()
  const {cnx: client} = useSession()
  const mutate = useMutate()
  const setErrorAtom = useSetAtom(errorAtom)
  const [uploads, setUploads] = useState<Array<Upload>>([])
  const batch = createBatch(mutate)

  async function batchMutations(...mutations: Array<Mutation>) {
    await batch(...mutations)
  }

  async function createEntry(upload: Upload) {
    const entryId = upload.info?.entryId ?? createId()
    const {parentId} = upload.to
    const buffer = await upload.file.arrayBuffer()
    const contentHash = await createContentHash(
      EntryPhase.Published,
      new Uint8Array(buffer)
    )
    const parent = await graph.preferPublished.maybeGet(
      Entry({entryId: parentId}).select({
        level: Entry.level,
        entryId: Entry.entryId,
        url: Entry.url,
        path: Entry.path,
        parentPaths({parents}) {
          return parents().select(Entry.path)
        }
      })
    )
    const prev = await graph.preferPublished.maybeGet(Entry({parent: parentId}))
    const path = basename(upload.file.name.toLowerCase())
    const entryLocation = {
      workspace: upload.to.workspace,
      root: upload.to.root,
      locale: null,
      path: path,
      phase: EntryPhase.Published
    }
    const filePath = entryFilepath(
      config,
      entryLocation,
      parent ? parent.parentPaths.concat(parent.path) : []
    )
    const extension = extname(path)
    const parentDir = dirname(filePath)
    const {location} = upload.info!
    const workspace = Workspace.data(config.workspaces[upload.to.workspace])
    const prefix = workspace.mediaDir && normalize(workspace.mediaDir)
    const fileLocation =
      prefix && location.startsWith(prefix)
        ? location.slice(prefix.length)
        : location

    const entry: Media.File = {
      ...entryLocation,
      parent: parent?.entryId ?? null,
      entryId: entryId,
      type: 'MediaFile',
      url: (parent ? parent.url : '') + '/' + path,
      title: basename(path, extension),
      seeded: false,
      modifiedAt: Date.now(),
      searchableText: '',
      index: generateKeyBetween(null, prev?.index ?? null),
      i18nId: entryId,

      level: parent ? parent.level + 1 : 0,
      parentDir: parentDir,
      filePath,
      childrenDir: filePath.slice(0, -'.json'.length),
      contentHash,
      active: true,
      main: true,
      data: {
        title: basename(path, extension),
        location: fileLocation,
        extension: extension,
        size: buffer.byteLength,
        hash: contentHash,
        width: upload.width,
        height: upload.height,
        averageColor: upload.averageColor,
        focus: upload.focus,
        thumbHash: upload.thumbHash,
        preview: upload.preview
      }
    }
    const file = entryFileName(
      config,
      entry,
      parent ? parent.parentPaths.concat(parent.path) : []
    )
    return {file, entry}
  }

  async function uploadFile(upload: Upload) {
    function update(upload: Upload) {
      setUploads(current => {
        const result = current.slice()
        const index = current.findIndex(u => u.id === upload.id)
        if (index === -1) return result
        result[index] = upload
        return result
      })
    }
    while (true) {
      const next = await tasker[upload.status](() =>
        process(upload, createEntry, client, batchMutations)
      ).catch(error => {
        return {...upload, error, status: UploadStatus.Done}
      })
      update(next)
      if (next.status === UploadStatus.Done) {
        if (next.error) {
          setErrorAtom(next.error.message, next.error)
        }
        const result = next.result as Media.Image | undefined
        if (!result) break
        onSelect?.(result)
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
