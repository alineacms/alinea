import {Media} from 'alinea/backend/Media'
import {
  Connection,
  Entry,
  EntryPhase,
  EntryRow,
  HttpError,
  Workspace,
  slugify
} from 'alinea/core'
import {entryFileName, entryFilepath} from 'alinea/core/EntryFilenames'
import {createId} from 'alinea/core/Id'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {createPreview} from 'alinea/core/media/CreatePreview'
import {isImage} from 'alinea/core/media/IsImage'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {createFileHash} from 'alinea/core/util/ContentHash'
import {createEntryRow} from 'alinea/core/util/EntryRows'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {
  basename,
  dirname,
  extname,
  join,
  normalize
} from 'alinea/core/util/Paths'
import {atom, useAtom, useSetAtom} from 'jotai'
import pLimit from 'p-limit'
import {useEffect} from 'react'
import {useMutate} from '../atoms/DbAtoms.js'
import {errorAtom} from '../atoms/ErrorAtoms.js'
import {withResolvers} from '../util/WithResolvers.js'
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
  info?: Connection.UploadResponse
  preview?: string
  averageColor?: string
  focus?: {x: number; y: number}
  thumbHash?: string
  width?: number
  height?: number
  result?: Media.File
  error?: Error
  replace?: {entry: EntryRow; entryFile: string}
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
  publishUpload: (upload: Upload) => Promise<Media.File>,
  client: Connection
): Promise<Upload> {
  switch (upload.status) {
    case UploadStatus.Queued:
      const next = isImage(upload.file.name)
        ? UploadStatus.CreatingPreview
        : UploadStatus.Uploading
      return {...upload, status: next}
    case UploadStatus.CreatingPreview: {
      const previewData = await createPreview(upload.file)
      return {
        ...upload,
        ...previewData,
        status: UploadStatus.Uploading
      }
    }
    case UploadStatus.Uploading: {
      const fileName = upload.file.name
      const extension = extname(fileName)
      const path = slugify(basename(fileName, extension))
      const file = join(upload.to.directory, path + extension)
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
      const {replace} = upload
      const info = upload.info!
      const entry = await publishUpload(upload)
      return {...upload, result: entry, status: UploadStatus.Done}
    }
    case UploadStatus.Done:
      throw new Error('Should not end up here')
  }
}

function createBatch(mutate: (mutations: Array<Mutation>) => Promise<void>) {
  let trigger = withResolvers()
  let nextRun: any = undefined
  const batch = [] as Array<Mutation>
  async function run() {
    const todo = batch.splice(0, batch.length)
    try {
      await batchTasker(() => mutate(todo))
      trigger.resolve(void 0)
    } catch (error) {
      trigger.reject(error)
    } finally {
      trigger = withResolvers()
    }
  }
  return (...mutations: Array<Mutation>) => {
    batch.push(...mutations)
    clearTimeout(nextRun)
    nextRun = setTimeout(run, 200)
    return trigger.promise
  }
}

const uploadsAtom = atom<Array<Upload>>([])

export function useUploads(onSelect?: (entry: EntryRow) => void) {
  const config = useConfig()
  const graph = useGraph()
  const {cnx: client} = useSession()
  const mutate = useMutate()
  const setErrorAtom = useSetAtom(errorAtom)
  const [uploads, setUploads] = useAtom(uploadsAtom)
  const batch = createBatch(mutate)

  useEffect(() => {
    // Clear upload list on unmount
    return () => setUploads([])
  }, [])

  async function batchMutations(...mutations: Array<Mutation>) {
    await batch(...mutations)
  }

  async function createEntry(upload: Upload) {
    const entryId = upload.info?.entryId ?? createId()
    const {parentId} = upload.to
    const buffer = await upload.file.arrayBuffer()
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

    const extension = extname(upload.file.name)
    const path = slugify(basename(upload.file.name, extension))
    const prev = await graph.preferPublished.maybeGet(Entry({parent: parentId}))

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
    const parentDir = dirname(filePath)
    const {location} = upload.info!
    const workspace = Workspace.data(config.workspaces[upload.to.workspace])
    const prefix = workspace.mediaDir && normalize(workspace.mediaDir)
    const fileLocation =
      prefix && location.startsWith(prefix)
        ? location.slice(prefix.length)
        : location

    const hash = await createFileHash(new Uint8Array(buffer))
    const title = basename(upload.file.name, extension)
    const entry = await createEntryRow<Media.File>(config, {
      ...entryLocation,
      parent: parent?.entryId ?? null,
      entryId: entryId,
      type: 'MediaFile',
      url: (parent ? parent.url : '') + '/' + path,
      title,
      seeded: null,
      modifiedAt: Date.now(),
      searchableText: '',
      index: generateKeyBetween(null, prev?.index ?? null),
      i18nId: entryId,

      level: parent ? parent.level + 1 : 0,
      parentDir: parentDir,
      filePath,
      childrenDir: filePath.slice(0, -'.json'.length),
      active: true,
      main: true,
      data: {
        title,
        location: fileLocation,
        extension: extension,
        size: buffer.byteLength,
        hash,
        width: upload.width,
        height: upload.height,
        averageColor: upload.averageColor,
        focus: upload.focus,
        thumbHash: upload.thumbHash,
        preview: upload.preview
      }
    })
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
        process(upload, publishUpload, client)
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

  async function publishUpload(upload: Upload) {
    const {replace} = upload
    const info = upload.info!
    const {file, entry} = await createEntry(upload)
    if (!replace) {
      await batchMutations(
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
      return entry
    }
    const newEntry = await createEntryRow<Media.File>(config, {
      ...replace.entry,
      data: {...entry.data, title: replace.entry.title}
    })
    const mediaFile = replace.entry.data as MediaFile
    await batchMutations(
      {
        type: MutationType.Edit,
        entryId: replace.entry.entryId,
        file: replace.entryFile,
        entry: newEntry
      },
      {
        type: MutationType.Upload,
        entryId: replace.entry.entryId,
        url: info.previewUrl,
        file: info.location
      },
      {
        type: MutationType.FileRemove,
        entryId: replace.entry.entryId,
        file: replace.entryFile,
        workspace: replace.entry.workspace,
        location:
          Media.ORIGINAL_LOCATION in mediaFile
            ? (mediaFile[Media.ORIGINAL_LOCATION] as string)
            : mediaFile.location,
        replace: true
      }
    )
    return newEntry
  }

  async function upload(
    files: Array<File>,
    to: UploadDestination,
    replace?: {entry: EntryRow; entryFile: string}
  ) {
    const uploads: Array<Upload> = Array.from(files).map(file => {
      return {id: createId(), file, to, replace, status: UploadStatus.Queued}
    })
    setUploads(current => [...uploads, ...current])
    return Promise.all(uploads.map(uploadFile))
  }

  return {upload, uploads}
}
