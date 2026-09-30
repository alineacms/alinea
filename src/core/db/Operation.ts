import type {Config} from '../Config.js'
import type {EntryStatus} from '../Entry.js'
import {Field} from '../Field.js'
import {HttpError} from '../HttpError.js'
import {createId} from '../Id.js'
import type {CreateInputRow, StoredRow} from '../Infer.js'
import type {ImagePreviewDetails} from '../media/CreatePreview.js'
import {
  hasImageEdit,
  imageResizeOptions,
  isTransformableImage,
  type ImageEdit,
  type ImageTransform
} from '../media/ImageTransform.js'
import {isImage} from '../media/IsImage.js'
import {MediaLocation} from '../media/MediaLocation.js'
import {MediaFile} from '../media/MediaTypes.js'
import {assertUploadSize} from '../media/UploadLimits.js'
import {assert} from '../util/Assert.js'
import {Schema} from '../Schema.js'
import {Type} from '../Type.js'
import type {User} from '../User.js'
import {createFileHash} from '../util/ContentHash.js'
import {keys} from '../util/Objects.js'
import {basename, extname} from '../util/Paths.js'
import {slugify} from '../util/Slugs.js'
import {Workspace} from '../Workspace.js'
import type {Mutation} from './Mutation.js'
import type {WriteableGraph} from './WriteableGraph.js'

type Awaitable<T> = T | Promise<T>
type Task = (graph: WriteableGraph) => Awaitable<Array<Mutation>>

export class Operation {
  constructor(public task: Task) {}
}

export interface CreateQuery<Fields> {
  type: Type<Fields>
  id?: string
  workspace?: string
  root?: string
  parentId?: string | null
  locale?: string | null
  status?: 'draft' | 'published' | 'archived'
  set: Partial<CreateInputRow<Fields>>
  insertOrder?: 'first' | 'last'
  overwrite?: boolean
}

function typeName(config: Config, type: Type) {
  const typeNames = Schema.typeNames(config.schema)
  const typeName = typeNames.get(type)!
  if (!typeName)
    throw new Error(`Type "${Type.label(type)}" not found in Schema`)
  return typeName
}

export class CreateOp<Fields> extends Operation {
  id: string
  constructor(op: CreateQuery<Fields>) {
    super(async (db): Promise<Array<Mutation>> => {
      const {config} = db
      return [
        {
          op: 'create',
          id: this.id,
          locale: op.locale ?? null,
          parentId: op.parentId ?? null,
          type: typeName(config, op.type),
          data: initializeSet(op.type, op.set),
          insertOrder: op.insertOrder,
          status: op.status,
          overwrite: op.overwrite,
          root: op.root,
          workspace: op.workspace
        }
      ]
    })
    this.id = op.id ?? createId()
  }
}

function initializeSet<Fields>(
  type: Type<Fields>,
  set: Partial<CreateInputRow<Fields>>
): Record<string, unknown> {
  const result = {...set} as Record<string, unknown>
  for (const key of keys(result)) {
    const field = Type.field(type, key)
    if (field) result[key] = Field.withInitialValue(field, result[key])
  }
  return result
}

export class DeleteOp extends Operation {
  constructor(protected entryIds: Array<string>) {
    super((): Array<Mutation> => {
      return entryIds.map(id => {
        return {
          op: 'remove',
          id
        }
      })
    })
  }
}

export interface DiscardQuery {
  id: string
  locale?: string | null
  status: 'draft' | 'archived' | 'published'
}

export class DiscardOp extends Operation {
  constructor(query: DiscardQuery) {
    super((): Array<Mutation> => {
      return [
        {
          op: 'remove',
          ...query
        }
      ]
    })
  }
}

export interface UpdateQuery<Fields> {
  type?: Type<Fields>
  id: string
  set: Partial<StoredRow<Fields>>
  status?: 'draft' | 'published' | 'archived'
  locale?: string | null
}

export class UpdateOperation<Definition> extends Operation {
  constructor(query: UpdateQuery<Definition>) {
    super((): Array<Mutation> => {
      const {status = 'published', locale = null, id, set} = query
      return [
        {
          op: 'update',
          id,
          locale,
          status: status as EntryStatus,
          set
        }
      ]
    })
  }
}

export interface MoveQuery {
  id: string
  target: string
  dropPosition: 'after' | 'before' | 'on'
  targetType?: 'entry' | 'root'
}

export class MoveOperation extends Operation {
  constructor(query: MoveQuery) {
    super((): Array<Mutation> => {
      return [{op: 'move', ...query, targetType: query.targetType ?? 'entry'}]
    })
  }
}

export interface PublishQuery {
  id: string
  status: 'draft' | 'archived'
  locale?: string | null
}

export class PublishOperation extends Operation {
  constructor(query: PublishQuery) {
    super((): Array<Mutation> => {
      return [{op: 'publish', ...query, locale: query.locale ?? null}]
    })
  }
}

export interface UnpublishQuery {
  id: string
  locale?: string | null
}

export class UnpublishOperation extends Operation {
  constructor(query: UnpublishQuery) {
    super((): Array<Mutation> => {
      return [{op: 'unpublish', ...query, locale: query.locale ?? null}]
    })
  }
}

export interface ArchiveQuery {
  id: string
  locale?: string | null
}

export class ArchiveOperation extends Operation {
  constructor(query: ArchiveQuery) {
    super((): Array<Mutation> => {
      return [{op: 'archive', ...query, locale: query.locale ?? null}]
    })
  }
}

export interface UploadQuery {
  file: File | [string, Uint8Array]
  workspace?: string
  root?: string
  parentId?: string | null
  createPreview?(blob: Blob): Promise<ImagePreviewDetails | undefined>
  /** Rotate and crop the image before it is uploaded */
  edit?: ImageEdit
  /**
   * Applies the edit and scales down images larger than the resizeImages
   * option of the config: `alinea/core/media/TransformImage` does so in the
   * browser or with sharp
   */
  transformImage?(
    blob: Blob,
    fileName: string,
    transform: ImageTransform
  ): Promise<Blob>
  onProgress?(progress: UploadProgress): void
  replaceId?: string
  /** Recorded as the creator, or the last editor of a replaced file */
  user?: User | null
}

export interface UploadProgress {
  loaded: number
  total?: number
}

export class UploadOperation extends Operation {
  id: string

  constructor(query: UploadQuery) {
    super(async (db): Promise<Array<Mutation>> => {
      const entryId = this.id
      const {file, createPreview, edit, transformImage} = query
      const {workspace: _workspace, root: _root, parentId: _parentId} = query
      const fileName = Array.isArray(file) ? file[0] : file.name
      const workspace = _workspace ?? Object.keys(db.config.workspaces)[0]
      const root =
        _root ?? Workspace.defaultMediaRoot(db.config.workspaces[workspace])
      let blob: Blob = Array.isArray(file)
        ? new Blob([file[1] as BlobPart])
        : file
      let contentType =
        file instanceof Blob ? file.type : 'application/octet-stream'
      const source = blob
      const edited = hasImageEdit(edit)
      assert(
        !edited || transformImage,
        'Editing an upload needs transformImage'
      )
      const resize = imageResizeOptions(db.config.resizeImages)
      const bytes = new Uint8Array(await source.arrayBuffer())
      if (
        transformImage &&
        (edited || resize) &&
        isTransformableImage(fileName, bytes)
      ) {
        const transformed = await transformImage(blob, fileName, {edit, resize})
        // Scaling down alone must make the file smaller
        if (edited || transformed.size < blob.size) {
          blob = transformed
          contentType = transformed.type
        }
      }
      // The hash of the file as picked, so uploading it again is recognized
      // after it was scaled down
      const sourceHash =
        blob !== source && !edited ? await createFileHash(bytes) : undefined
      const fileSize = blob.size
      assertUploadSize(fileName, fileSize, db.config.maxUploadSize)
      const body = await blob.arrayBuffer()
      const originalExtension = extname(fileName)
      const title = basename(fileName, originalExtension)
      const extension = originalExtension.toLowerCase()
      const path = slugify(title)
      const uploadLocation = MediaLocation.storagePath(
        db.config,
        workspace,
        path + extension
      )
      const info = await db.prepareUpload(uploadLocation, {
        size: fileSize
      })
      const previewData = isImage(fileName)
        ? await createPreview?.(blob)
        : undefined
      await sendUpload(info.url, info.method ?? 'POST', contentType, body, {
        headers: info.headers,
        onProgress: query.onProgress
      })
      const hash = await createFileHash(new Uint8Array(body))
      const fileLocation = MediaLocation.entryLocation(
        db.config,
        workspace,
        info.location
      )
      const uploadFile: Mutation = {
        op: 'uploadFile',
        url: info.previewUrl,
        location: MediaLocation.storagePath(db.config, workspace, fileLocation)
      }
      // A replace keeps the details of the file it replaces
      const replaced = query.replaceId
        ? await db.first({
            id: query.replaceId,
            status: 'preferDraft',
            select: MediaFile.metadata
          })
        : undefined
      const createEntry: Mutation = {
        op: 'create',
        id: entryId,
        locale: null,
        parentId: _parentId ?? null,
        type: 'MediaFile',
        root,
        workspace,
        data: Type.beforeSave(
          MediaFile,
          {
            title,
            location: fileLocation,
            // Local uploads have no preview url, leave the empty value out
            ...(info.previewUrl ? {previewUrl: info.previewUrl} : {}),
            extension,
            size: body.byteLength,
            hash,
            ...(sourceHash ? {sourceHash} : {}),
            ...previewData,
            metadata: replaced ?? undefined
          },
          {
            action: query.replaceId ? 'update' : 'create',
            user: query.user,
            now: new Date()
          }
        ),
        overwrite: query.replaceId !== undefined
      }
      return [uploadFile, createEntry]
    })
    this.id = query.replaceId ?? createId()
  }
}

interface UploadFileOptions {
  headers?: Record<string, string>
  onProgress?(progress: UploadProgress): void
}

async function sendUpload(
  url: string,
  method: string,
  contentType: string,
  body: ArrayBuffer | Uint8Array,
  options: UploadFileOptions
) {
  const {headers = {}, onProgress} = options
  if (onProgress && typeof XMLHttpRequest !== 'undefined') {
    await uploadFileWithProgress(
      url,
      method,
      {...headers, 'Content-Type': contentType},
      body,
      onProgress
    )
    return
  }
  await fetch(url, {
    method,
    headers: {...headers, 'Content-Type': contentType},
    body: body as BodyInit
  }).then(result => {
    if (!result.ok)
      throw new HttpError(result.status, 'Could not reach server for upload')
  })
}

function uploadFileWithProgress(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: ArrayBuffer | Uint8Array,
  onProgress: (progress: UploadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(method, url)
    for (const [name, value] of Object.entries(headers))
      request.setRequestHeader(name, value)
    request.upload.addEventListener('progress', event => {
      onProgress({
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : undefined
      })
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress({loaded: body.byteLength, total: body.byteLength})
        resolve()
        return
      }
      reject(new HttpError(request.status, 'Could not reach server for upload'))
    })
    request.addEventListener('error', () => {
      reject(new HttpError(request.status, 'Could not reach server for upload'))
    })
    request.send(body as XMLHttpRequestBodyInit)
  })
}

export function update<Definition>(
  query: UpdateQuery<Definition>
): UpdateOperation<Definition> {
  return new UpdateOperation<Definition>(query)
}

export function create<Definition>(query: CreateQuery<Definition>) {
  return new CreateOp<Definition>(query)
}

export function remove(...entryIds: Array<string>) {
  return new DeleteOp(entryIds)
}

export function discard(query: DiscardQuery) {
  return new DiscardOp(query)
}

export function upload(query: UploadQuery) {
  return new UploadOperation(query)
}

export function move(query: MoveQuery) {
  return new MoveOperation(query)
}

export function publish(query: PublishQuery) {
  return new PublishOperation(query)
}

export function archive(query: ArchiveQuery) {
  return new ArchiveOperation(query)
}
