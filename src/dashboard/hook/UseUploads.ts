import type {UploadResponse} from 'alinea/core/Connection'
import type {EntryRow} from 'alinea/core/EntryRow'
import {createPreview} from 'alinea/core/media/CreatePreview'
import type {MediaFile} from 'alinea/core/media/MediaTypes'
import {atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import pLimit from 'p-limit'
import {useEffect} from 'react'
import {dbAtom} from '../atoms/DbAtoms.js'
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

const batchTasker = pLimit(1)

/*function createBatch(db: LocalDB) {
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
}*/

const uploadsAtom = atom<Array<Upload>>([])

export function useUploads(onSelect?: (entry: EntryRow) => void) {
  const config = useConfig()
  const graph = useGraph()
  const {cnx: client} = useSession()
  const db = useAtomValue(dbAtom)
  const setErrorAtom = useSetAtom(errorAtom)
  const [uploads, setUploads] = useAtom(uploadsAtom)
  //const batch = createBatch(db)

  useEffect(() => {
    // Clear upload list on unmount
    return () => setUploads([])
  }, [])

  /*async function batchMutations(...mutations: Array<Mutation>) {
    await batch(...mutations)
  }

  async function createEntry(upload: Upload) {
    const entryId = upload.info?.entryId ?? createId()
    const {parentId} = upload.to
    const buffer = await upload.file.arrayBuffer()
    const parent = parentId
      ? await graph.first({
          select: {
            level: Entry.level,
            entryId: Entry.id,
            url: Entry.url,
            path: Entry.path,
            parentPaths: {
              edge: 'parents',
              select: Entry.path
            }
          },
          id: parentId,
          status: 'preferPublished'
        })
      : null

    const extensionOriginal = extname(upload.file.name)
    const extension = extensionOriginal.toLowerCase()
    const path = slugify(basename(upload.file.name, extensionOriginal))
    const prev = await graph.first({
      select: Entry,
      parentId: parentId,
      status: 'preferPublished'
    })
    const entryLocation = {
      workspace: upload.to.workspace,
      root: upload.to.root,
      locale: null,
      path: path,
      status: 'published' as EntryStatus
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
    const title = basename(upload.file.name, extensionOriginal)
    const entry = await createEntryRow<EntryRow<MediaFile>>(config, {
      ...entryLocation,
      parentId: parent?.entryId ?? null,
      id: entryId,
      type: 'MediaFile',
      url: `${parent ? parent.url : ''}/${path}`,
      title,
      seeded: null,
      searchableText: '',
      index: generateKeyBetween(null, prev?.index ?? null),

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
        const result = next.result as EntryRow<MediaImage> | undefined
        if (!result) break
        onSelect?.(result)
        break
      }
      upload = next
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
          entryId: entry.id,
          locale: null,
          file,
          entry
        },
        {
          type: MutationType.Upload,
          entryId: entry.id,
          url: info.previewUrl,
          file: info.location
        }
      )
      return entry
    }
    const newEntry = await createEntryRow<EntryRow<MediaFile>>(config, {
      ...replace.entry,
      data: {...entry.data, title: replace.entry.title}
    })
    const mediaFile = replace.entry.data as MediaFile
    await batchMutations(
      {
        type: MutationType.Edit,
        entryId: replace.entry.id,
        locale: null,
        file: replace.entryFile,
        entry: newEntry
      },
      {
        type: MutationType.Upload,
        entryId: replace.entry.id,
        url: info.previewUrl,
        file: info.location
      },
      {
        type: MutationType.RemoveFile,
        entryId: replace.entry.id,
        locale: null,
        file: replace.entryFile,
        workspace: replace.entry.workspace,
        location:
          MEDIA_LOCATION in mediaFile
            ? (mediaFile[MEDIA_LOCATION] as string)
            : mediaFile.location,
        replace: true
      }
    )
    return newEntry
  }*/

  async function upload(
    files: Array<File>,
    to: UploadDestination,
    replace?: {entry: EntryRow; entryFile: string}
  ) {
    for (const file of files) {
      // sync: fixme
      if (replace) throw new Error('Not implemented')
      await db.upload({
        file,
        createPreview,
        parentId: to.parentId,
        workspace: to.workspace,
        root: to.root
      })
    }
    /*const uploads: Array<Upload> = Array.from(files).map(file => {
      return {id: createId(), file, to, replace, status: UploadStatus.Queued}
    })
    setUploads(current => [...uploads, ...current])
    return Promise.all(uploads.map(uploadFile))*/
  }

  return {upload, uploads}
}
