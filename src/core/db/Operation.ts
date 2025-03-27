import type {Config} from '../Config.js'
import type {EntryStatus} from '../Entry.js'
import {HttpError} from '../HttpError.js'
import {createId} from '../Id.js'
import type {StoredRow} from '../Infer.js'
import {Schema} from '../Schema.js'
import {Type} from '../Type.js'
import {Workspace} from '../Workspace.js'
import type {ImagePreviewDetails} from '../media/CreatePreview.js'
import {isImage} from '../media/IsImage.js'
import {createFileHash} from '../util/ContentHash.js'
import {workspaceMediaDir} from '../util/EntryFilenames.js'
import {keys} from '../util/Objects.js'
import {basename, extname, join, normalize} from '../util/Paths.js'
import {slugify} from '../util/Slugs.js'
import type {LocalDB} from './LocalDB.js'
import type {Mutation} from './Mutation.js'

type Awaitable<T> = T | Promise<T>
type Task = (graph: LocalDB) => Awaitable<Array<Mutation>>

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
  set: Partial<StoredRow<Fields>>
  insertOrder?: 'first' | 'last'
}

function typeName(config: Config, type: Type) {
  const typeNames = Schema.typeNames(config.schema)
  const typeName = typeNames.get(type)!
  if (!typeName)
    throw new Error(`Type "${Type.label(type)}" not found in Schema`)
  return typeName
}

export class CreateOperation<Fields> extends Operation {
  id: string
  constructor(op: CreateQuery<Fields>) {
    super((graph): Array<Mutation> => {
      const workspaces = keys(graph.config.workspaces)
      const workspace = op.workspace ?? workspaces[0]
      const roots = keys(graph.config.workspaces[workspace])
      const root = op.root ?? roots[0]
      return [
        {
          op: 'create',
          id: this.id,
          locale: op.locale ?? null,
          parentId: op.parentId ?? null,
          type: typeName(graph.config, op.type),
          root,
          workspace,
          data: op.set ?? {},
          insertOrder: op.insertOrder,
          status: op.status
        }
      ]
    })
    this.id = op.id ?? createId()
  }
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
  after: string | null
  toParent?: string
  toRoot?: string
}

export class MoveOperation extends Operation {
  constructor(query: MoveQuery) {
    super((): Array<Mutation> => {
      return [{op: 'move', ...query}]
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
  createPreview?(blob: Blob): Promise<ImagePreviewDetails>
}

export class UploadOperation extends Operation {
  id = createId()

  constructor(query: UploadQuery) {
    super(async (db): Promise<Array<Mutation>> => {
      const {config} = db
      const entryId = this.id
      const {file, createPreview} = query
      const {workspace: _workspace, root: _root, parentId: _parentId} = query
      const fileName = Array.isArray(file) ? file[0] : file.name
      const body = Array.isArray(file) ? file[1] : await file.arrayBuffer()
      const workspace = _workspace ?? Object.keys(config.workspaces)[0]
      const root =
        _root ?? Workspace.defaultMediaRoot(config.workspaces[workspace])
      const extension = extname(fileName)
      const path = slugify(basename(fileName, extension))
      const directory = workspaceMediaDir(config, workspace)
      const uploadLocation = join(directory, path + extension)
      const info = await db.prepareUpload(uploadLocation)
      const previewData = isImage(fileName)
        ? await createPreview?.(file instanceof Blob ? file : new Blob([body]))
        : undefined
      await fetch(info.url, {method: info.method ?? 'POST', body}).then(
        async result => {
          if (!result.ok)
            throw new HttpError(
              result.status,
              'Could not reach server for upload'
            )
        }
      )
      const title = basename(fileName, extension)
      const hash = await createFileHash(new Uint8Array(body))
      const {mediaDir} = Workspace.data(config.workspaces[workspace])
      const prefix = mediaDir && normalize(mediaDir)
      const fileLocation =
        prefix && info.location.startsWith(prefix)
          ? info.location.slice(prefix.length)
          : info.location
      const uploadFile: Mutation = {
        op: 'uploadFile',
        url: info.previewUrl,
        location: info.location
      }
      const createEntry: Mutation = {
        op: 'create',
        id: entryId,
        locale: null,
        parentId: _parentId ?? null,
        type: 'MediaFile',
        root,
        workspace,
        data: {
          title,
          location: fileLocation,
          extension,
          size: body.byteLength,
          hash,
          ...previewData
        }
      }
      return [uploadFile, createEntry]
    })
  }
}

export function update<Definition>(
  query: UpdateQuery<Definition>
): UpdateOperation<Definition> {
  return new UpdateOperation<Definition>(query)
}

export function create<Definition>(query: CreateQuery<Definition>) {
  return new CreateOperation<Definition>(query)
}

export function remove(...entryIds: Array<string>) {
  return new DeleteOp(entryIds)
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
