import {Blob, File} from '@alinea/iso'
import {StoredRow} from 'alinea/core/Infer'
import {ImagePreviewDetails} from 'alinea/core/media/CreatePreview'
import type {CMS} from './CMS.js'
import {Config} from './Config.js'
import {Entry} from './Entry.js'
import {EntryRow, EntryStatus} from './EntryRow.js'
import {Status} from './Graph.js'
import {HttpError} from './HttpError.js'
import {createId} from './Id.js'
import {Mutation, MutationType} from './Mutation.js'
import {Root} from './Root.js'
import {Schema} from './Schema.js'
import {getScope} from './Scope.js'
import {EntryUrlMeta, Type} from './Type.js'
import {Workspace} from './Workspace.js'
import {isImage} from './media/IsImage.js'
import {createFileHash} from './util/ContentHash.js'
import {
  entryChildrenDir,
  entryFileName,
  entryFilepath,
  entryUrl,
  workspaceMediaDir
} from './util/EntryFilenames.js'
import {createEntryRow, entryParentPaths} from './util/EntryRows.js'
import {generateKeyBetween} from './util/FractionalIndexing.js'
import {entries, fromEntries} from './util/Objects.js'
import {basename, extname, join, normalize} from './util/Paths.js'
import {slugify} from './util/Slugs.js'

export interface Transaction {
  (cms: CMS): Promise<Array<Mutation>>
}

export interface Operation {
  [Operation.Data]: Transaction
}

export class Operation {
  static readonly Data = Symbol.for('@alinea/Operation.Data')

  constructor(tx: Transaction) {
    this[Operation.Data] = tx
  }

  protected typeName(config: Config, type: Type) {
    const typeNames = Schema.typeNames(config.schema)
    const typeName = typeNames.get(type)!
    if (!typeName)
      throw new Error(`Type "${Type.label(type)}" not found in Schema`)
    return typeName
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
    super(async (cms: CMS): Promise<Array<Mutation>> => {
      const entryId = this.id
      const {file, createPreview} = query
      const {workspace: _workspace, root: _root, parentId: _parentId} = query
      const {config, connect} = cms
      const fileName = Array.isArray(file) ? file[0] : file.name
      const body = Array.isArray(file) ? file[1] : await file.arrayBuffer()
      const workspace = _workspace ?? Object.keys(config.workspaces)[0]
      const root =
        _root ?? Workspace.defaultMediaRoot(config.workspaces[workspace])
      const extension = extname(fileName)
      const path = slugify(basename(fileName, extension))
      const directory = workspaceMediaDir(config, workspace)
      const uploadLocation = join(directory, path + extension)
      const cnx = await connect()
      const info = await cnx.prepareUpload(uploadLocation)
      const previewData = isImage(fileName)
        ? await createPreview?.(file instanceof Blob ? file : new Blob([body]))
        : undefined
      await fetch(info.url, {method: info.method ?? 'POST', body}).then(
        async result => {
          if (!result.ok)
            throw new HttpError(
              result.status,
              `Could not reach server for upload`
            )
        }
      )
      const parent = _parentId
        ? await cms.first({
            select: Entry,
            id: _parentId,
            status: 'preferPublished'
          })
        : null
      const title = basename(fileName, extension)
      const hash = await createFileHash(new Uint8Array(body))
      const {mediaDir} = Workspace.data(config.workspaces[workspace])
      const prefix = mediaDir && normalize(mediaDir)
      const fileLocation =
        prefix && info.location.startsWith(prefix)
          ? info.location.slice(prefix.length)
          : info.location
      const entryData = {
        title,
        location: fileLocation,
        extension,
        size: body.byteLength,
        hash,
        ...previewData
      }
      const entry = await createEntry(
        config,
        'MediaFile',
        {
          path,
          id: entryId,
          workspace,
          root,
          data: entryData
        },
        parent
      )
      const parentPaths = entryParentPaths(config, entry)
      const entryFile = entryFileName(config, entry, parentPaths)
      return [
        {
          type: MutationType.Upload,
          entryId: entryId,
          url: info.previewUrl,
          file: info.location
        },
        {
          type: MutationType.Create,
          locale: entry.locale,
          entryId: entry.id,
          file: entryFile,
          entry
        }
      ]
    })
  }
}

export class DeleteOp extends Operation {
  constructor(protected entryIds: Array<string>) {
    super(async cms => {
      const entries = await cms.find({
        select: Entry,
        id: {in: entryIds},
        status: 'preferPublished'
      })
      return entries.map(entry => {
        const parentPaths = entryParentPaths(cms.config, entry)
        const file = entryFileName(cms.config, entry, parentPaths)
        return {
          type: MutationType.RemoveEntry,
          entryId: entry.id,
          locale: entry.locale,
          file
        }
      })
    })
  }
}

export interface UpdateQuery<Fields> {
  id: string
  locale?: string | null
  type?: Type<Fields>
  status?: Status
  set?: Partial<StoredRow<Fields>>
}

export class UpdateOperation<Definition> extends Operation {
  constructor(query: UpdateQuery<Definition>) {
    super(async cms => {
      const {status: changeStatus, set} = query
      const entryId = query.id
      let status: Status
      if (changeStatus === EntryStatus.Draft) status = 'preferDraft'
      else if (changeStatus === EntryStatus.Archived) status = 'preferPublished'
      else if (changeStatus === EntryStatus.Published) status = 'preferDraft'
      else status = 'preferPublished'
      const current = await cms.get({
        select: Entry,
        id: entryId,
        locale: query.locale,
        status
      })
      const parent = current.parentId
        ? await cms.get({
            select: Entry,
            id: current.parentId,
            locale: query.locale,
            status: 'preferPublished'
          })
        : undefined
      const parentPaths = entryParentPaths(cms.config, current)

      const file = entryFileName(
        cms.config,
        {...current, status: current.status},
        parentPaths
      )
      const type = cms.config.schema[current.type]
      const mutations: Array<Mutation> = []
      const createDraft = changeStatus === EntryStatus.Draft
      const fieldUpdates =
        set &&
        fromEntries(
          entries(set).map(([key, value]) => {
            return [key, value ?? null]
          })
        )
      const entry = await createEntry(
        cms.config,
        this.typeName(cms.config, type),
        {
          ...current,
          status: createDraft ? EntryStatus.Draft : current.status,
          data: {...current.data, ...fieldUpdates}
        },
        parent
      )
      if (createDraft || set)
        mutations.push({
          type: MutationType.Edit,
          entryId: entryId,
          locale: current.locale,
          file,
          entry
        })
      switch (changeStatus) {
        case EntryStatus.Published:
          mutations.push({
            type: MutationType.Publish,
            locale: current.locale,
            status: current.status,
            entryId: entryId,
            file
          })
          break
        case EntryStatus.Archived:
          mutations.push({
            type: MutationType.Archive,
            entryId: entryId,
            locale: current.locale,
            file
          })
          break
      }
      return mutations
    })
  }
}

export interface CreateQuery<Fields> {
  type: Type<Fields>
  workspace?: string
  root?: string
  parentId?: string | null
  locale?: string
  status?: EntryStatus
  set?: Partial<StoredRow<Fields>>
}

export class CreateOperation<Definition> extends Operation {
  id = createId()

  constructor(query: CreateQuery<Definition>) {
    super(async (cms): Promise<Array<Mutation>> => {
      const entryId = this.id
      const entry = await entryRow()
      const parentPaths = entryParentPaths(cms.config, entry)
      const file = entryFileName(cms.config, entry, parentPaths)
      return [
        {
          type: MutationType.Create,
          entryId: entry.id,
          locale: entry.locale,
          file,
          entry: entry
        }
      ]
      async function entryRow() {
        const {workspace, root, parentId, locale, set, status} = query
        const typeName = getScope(cms.config).nameOf(query.type)
        if (!typeName)
          throw new Error(
            `Type "${Type.label(query.type)}" not found in Schema`
          )
        const partial: Partial<EntryRow> = {
          id: entryId,
          status,
          type: typeName,
          workspace,
          root,
          parentId,
          locale,
          data: set
        }
        let parent: EntryRow | undefined
        try {
          parent = await (parentId
            ? cms.get({
                select: Entry,
                id: parentId,
                status: 'preferPublished'
              })
            : undefined)
        } catch {
          throw new Error(
            `Parent entry not found: ${parentId}, try commiting it first?`
          )
        }
        const previousIndex = await cms.first({
          status: 'preferPublished',
          select: Entry.index,
          parentId: parent?.id ?? null,
          orderBy: {desc: Entry.index, caseSensitive: true}
        })
        const index = generateKeyBetween(previousIndex, null)
        return createEntry(cms.config, typeName, {...partial, index}, parent)
      }
    })
  }
}

async function createEntry(
  config: Config,
  typeName: string,
  partial: Partial<Entry> = {title: 'Entry'},
  parent?: EntryRow | null
): Promise<EntryRow> {
  const type = config.schema[typeName]
  const workspace =
    parent?.workspace ?? partial.workspace ?? Object.keys(config.workspaces)[0]
  const root =
    parent?.root ?? partial.root ?? Object.keys(config.workspaces[workspace])[0]
  const locale =
    parent?.locale ??
    partial.locale ??
    Root.defaultLocale(config.workspaces[workspace][root]) ??
    null
  const title = partial.data?.title ?? partial.title ?? 'Entry'
  const status = partial.status ?? EntryStatus.Published
  const path = slugify(
    (status === EntryStatus.Published && partial.data?.path) ||
      (partial.path ?? title)
  )
  const entryData = {title, path, ...partial.data}
  const id = partial.id ?? createId()
  const details = {
    id,
    status,
    type: typeName,
    title,
    path,
    seeded: null,
    workspace: workspace,
    root: root,
    level: parent ? parent.level + 1 : 0,
    parentId: parent?.id ?? null,
    locale,
    index: partial.index ?? 'a0',
    modifiedAt: 0,
    active: partial.active ?? true,
    main: partial.main ?? true,
    data: entryData,
    searchableText: Type.searchableText(type, entryData)
  }
  const isI18n = Boolean(Root.data(config.workspaces[workspace][root]).i18n)
  const parentPaths =
    parent?.childrenDir
      .split('/')
      .filter(Boolean)
      .slice(isI18n ? 1 : 0) ?? []
  const filePath = entryFilepath(config, details, parentPaths)
  const childrenDir = entryChildrenDir(config, details, parentPaths)
  const urlMeta: EntryUrlMeta = {
    locale,
    path,
    status,
    parentPaths
  }
  const url = entryUrl(type, urlMeta)
  return createEntryRow(config, {
    ...details,
    filePath,
    childrenDir,
    parentDir: childrenDir.split('/').slice(0, -1).join('/'),
    url
  })
}
