import {Entry} from '#/core/Entry.js'
import {createPreview} from '#/core/media/CreatePreview.browser.js'
import {
  isTransformableImage,
  type ImageEdit
} from '#/core/media/ImageTransform.js'
import {isImage} from '#/core/media/IsImage.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {transformImage} from '#/core/media/TransformImage.browser.js'
import {createId} from '#/core/Id.js'
import {Permission} from '#/core/Role.js'
import {createFileHash} from '#/core/util/ContentHash.js'
import {basename, extname} from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'
import {atom} from 'jotai'
import {uploadProgressAtom} from './activity.js'
import {configAtom, graphAtom} from './core.js'
import {uploadSizeError} from './utils.js'
import {policyAtom} from './user.js'

export interface UploadDestination {
  workspace: string
  root: string
  parentId?: string
  parents?: Array<string>
}

export interface UploadItem {
  file: File
  edit?: ImageEdit
  /** The media entry whose file this upload replaces */
  replaceId?: string
}

export interface UploadFilesRequest extends UploadDestination {
  uploads: Array<UploadItem>
}

/** Uploads files, resolves with the ids of the uploaded media entries */
export const uploadFilesAtom = atom(
  null,
  async (get, set, request: UploadFilesRequest): Promise<Array<string>> => {
    if (request.uploads.length === 0) return []
    const config = get(configAtom)
    const graph = get(graphAtom)
    get(policyAtom).assert(Permission.Upload, {
      workspace: request.workspace,
      root: request.root,
      id: request.parentId,
      parents: request.parents
    })
    const destination = {
      workspace: request.workspace,
      root: request.root,
      parentId: request.parentId
    }
    const invalidUploads = request.uploads.flatMap(({file}) => {
      const error = uploadSizeError(file, config)
      return error ? [{id: createId(), file, error}] : []
    })
    if (invalidUploads.length > 0)
      set(uploadProgressAtom, {
        type: 'fail',
        uploads: invalidUploads,
        destination
      })
    const failedFiles = new Set(invalidUploads.map(upload => upload.file))
    const uploads = request.uploads
      .filter(upload => !failedFiles.has(upload.file))
      .map(upload => ({...upload, id: createId()}))
    if (uploads.length === 0) return []
    set(uploadProgressAtom, {type: 'start', uploads, destination})
    const uploaded = await Promise.all(
      uploads.map(async ({id, file, edit, replaceId}) => {
        try {
          const entry = await graph.upload({
            file,
            createPreview,
            transformImage,
            edit,
            ...(replaceId ? {replaceId} : {}),
            parentId: request.parentId,
            workspace: request.workspace,
            root: request.root,
            onProgress: progress =>
              set(uploadProgressAtom, {
                type: 'progress',
                id,
                progress
              })
          })
          set(uploadProgressAtom, {type: 'finish', ids: [id]})
          return entry?._id
        } catch (error) {
          set(uploadProgressAtom, {
            type: 'fail',
            uploads: [
              {
                id,
                file,
                error: error instanceof Error ? error.message : String(error)
              }
            ],
            destination
          })
        }
      })
    )
    return uploaded.filter(id => id !== undefined)
  }
)

/** A media file an upload matches */
export interface MediaMatch {
  id: string
  title: string
  workspace: string
  root: string
  parentId: string | null
  url: string
  extension: string
  preview?: string
  averageColor?: string
}

/**
 * `upload` adds the file, `existing` uses the media file that has the same
 * contents instead and `replace` swaps the file of the media file with the
 * same name
 */
export type PendingUploadAction = 'upload' | 'existing' | 'replace'

export interface PendingUpload {
  id: string
  file: File
  /** An object url of images the browser can show */
  previewUrl?: string
  /**
   * Dimensions of a jpeg, png or webp image, as the browser shows it. These
   * images can be rotated and cropped.
   */
  imageSize?: ImageSize
  /** A media file in the workspace with the same contents */
  duplicate?: MediaMatch
  /** A media file with the same name where the file is uploaded to */
  conflict?: MediaMatch
  action: PendingUploadAction
  edit?: ImageEdit
}

export interface ImageSize {
  width: number
  height: number
}

export interface PendingUploads {
  destination: UploadDestination
  /** The media file whose file is replaced, uploads only one file */
  replace?: MediaMatch
  uploads: Array<PendingUpload>
}

export interface UploadsRequest {
  files: Iterable<File> | ArrayLike<File>
  destination: UploadDestination
  /** Replace the file of this media entry */
  replaceId?: string
}

interface PendingUploadsState extends PendingUploads {
  resolve(ids: Array<string>): void
}

const pendingUploadsState = atom<PendingUploadsState | undefined>(undefined)

/** The files waiting to be confirmed in the upload dialog */
export const pendingUploadsAtom = atom((get): PendingUploads | undefined =>
  get(pendingUploadsState)
)

const matchSelection = {
  id: Entry.id,
  title: Entry.title,
  workspace: Entry.workspace,
  root: Entry.root,
  parentId: Entry.parentId,
  parents: Entry.parents,
  url: Entry.url,
  path: Entry.path,
  extension: MediaFile.extension,
  preview: MediaFile.preview,
  averageColor: MediaFile.averageColor,
  hash: MediaFile.hash,
  sourceHash: MediaFile.sourceHash
}

/**
 * Opens the upload dialog for files, once it knows which files exist
 * already. Resolves with the ids of the media entries that were uploaded or
 * picked instead, empty when the dialog is cancelled.
 */
export const requestUploadsAtom = atom(
  null,
  async (get, set, request: UploadsRequest): Promise<Array<string>> => {
    const files = Array.from(request.files)
    if (files.length === 0) return []
    const {destination, replaceId} = request
    const graph = get(graphAtom)
    const policy = get(policyAtom)
    policy.assert(Permission.Upload, {
      workspace: destination.workspace,
      root: destination.root,
      id: destination.parentId,
      parents: destination.parents
    })
    const scanned = await Promise.all(
      files.map(async file => {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const editable = isTransformableImage(file.name, bytes)
        return {
          hash: await createFileHash(bytes),
          imageSize: editable ? await imageSize(file) : undefined
        }
      })
    )
    const hashes = scanned.map(file => file.hash)
    const slugs = files.map(file =>
      slugify(basename(file.name, extname(file.name)))
    )
    const [duplicates, siblings, replaced] = await Promise.all([
      graph.find({
        type: MediaFile,
        workspace: destination.workspace,
        filter: {or: [{hash: {in: hashes}}, {sourceHash: {in: hashes}}]},
        select: matchSelection,
        status: 'preferPublished'
      }),
      replaceId
        ? []
        : graph.find({
            type: MediaFile,
            workspace: destination.workspace,
            root: destination.root,
            parentId: destination.parentId ?? null,
            filter: {_path: {in: slugs}},
            select: matchSelection,
            status: 'preferPublished'
          }),
      replaceId
        ? graph.first({
            type: MediaFile,
            id: replaceId,
            select: matchSelection,
            status: 'preferPublished'
          })
        : null
    ])
    const uploads = files.map((file, index): PendingUpload => {
      const {hash, imageSize} = scanned[index]
      const duplicate = duplicates.find(
        match =>
          match.id !== replaceId &&
          (match.hash === hash || match.sourceHash === hash)
      )
      // Replacing a file with the same name needs permission to update it
      const conflict = siblings.find(
        match =>
          match.path === slugs[index] &&
          policy.canUpdate({
            workspace: match.workspace,
            root: match.root,
            id: match.id,
            parents: match.parents,
            type: 'MediaFile'
          })
      )
      return {
        id: createId(),
        file,
        ...(isImage(file.name) ? {previewUrl: URL.createObjectURL(file)} : {}),
        ...(imageSize ? {imageSize} : {}),
        ...(duplicate ? {duplicate: mediaMatch(duplicate)} : {}),
        ...(conflict ? {conflict: mediaMatch(conflict)} : {}),
        action: replaceId ? 'replace' : duplicate ? 'existing' : 'upload'
      }
    })
    const previous = get(pendingUploadsState)
    if (previous) {
      releasePreviews(previous.uploads)
      previous.resolve([])
    }
    return new Promise(resolve => {
      set(pendingUploadsState, {
        destination,
        ...(replaced ? {replace: mediaMatch(replaced)} : {}),
        uploads,
        resolve
      })
    })
  }
)

export const updatePendingUploadAtom = atom(
  null,
  (
    get,
    set,
    id: string,
    update: Partial<Pick<PendingUpload, 'action' | 'edit'>>
  ) => {
    const pending = get(pendingUploadsState)
    if (!pending) return
    set(pendingUploadsState, {
      ...pending,
      uploads: pending.uploads.map(upload =>
        upload.id === id ? {...upload, ...update} : upload
      )
    })
  }
)

export const removePendingUploadAtom = atom(null, (get, set, id: string) => {
  const pending = get(pendingUploadsState)
  if (!pending) return
  releasePreviews(pending.uploads.filter(upload => upload.id === id))
  const uploads = pending.uploads.filter(upload => upload.id !== id)
  if (uploads.length > 0) {
    set(pendingUploadsState, {...pending, uploads})
    return
  }
  set(pendingUploadsState, undefined)
  pending.resolve([])
})

export const cancelPendingUploadsAtom = atom(null, (get, set) => {
  const pending = get(pendingUploadsState)
  if (!pending) return
  set(pendingUploadsState, undefined)
  releasePreviews(pending.uploads)
  pending.resolve([])
})

/** Closes the upload dialog and uploads the files as decided in it */
export const confirmPendingUploadsAtom = atom(null, async (get, set) => {
  const pending = get(pendingUploadsState)
  if (!pending) return
  set(pendingUploadsState, undefined)
  releasePreviews(pending.uploads)
  const {destination, replace} = pending
  const existing = pending.uploads.flatMap(upload =>
    upload.action === 'existing' && upload.duplicate
      ? [upload.duplicate.id]
      : []
  )
  const uploaded = await set(uploadFilesAtom, {
    ...destination,
    uploads: pending.uploads.flatMap((upload): Array<UploadItem> => {
      const replaceId =
        upload.action === 'replace'
          ? (replace?.id ?? upload.conflict?.id)
          : undefined
      if (upload.action === 'existing' && upload.duplicate) return []
      return [
        {
          file: upload.file,
          ...(upload.edit ? {edit: upload.edit} : {}),
          ...(replaceId ? {replaceId} : {})
        }
      ]
    })
  })
  pending.resolve([...existing, ...uploaded])
})

/** The dimensions of an image, undefined if the browser can not decode it */
async function imageSize(file: File): Promise<ImageSize | undefined> {
  try {
    const bitmap = await createImageBitmap(file)
    const {width, height} = bitmap
    bitmap.close()
    return {width, height}
  } catch {
    return undefined
  }
}

function releasePreviews(uploads: Array<PendingUpload>) {
  for (const upload of uploads)
    if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl)
}

function mediaMatch(row: MatchRow): MediaMatch {
  return {
    id: row.id,
    title: row.title,
    workspace: row.workspace,
    root: row.root,
    parentId: row.parentId,
    url: row.url,
    extension: row.extension,
    ...(row.preview ? {preview: row.preview} : {}),
    ...(row.averageColor ? {averageColor: row.averageColor} : {})
  }
}

interface MatchRow {
  id: string
  title: string
  workspace: string
  root: string
  parentId: string | null
  url: string
  extension: string
  preview?: string | null
  averageColor?: string | null
}
