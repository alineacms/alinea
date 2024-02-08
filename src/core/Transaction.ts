import {Blob, File} from '@alinea/iso'
import {ImagePreviewDetails} from 'alinea/core/media/CreatePreview'
import {CMS} from './CMS.js'
import {Config} from './Config.js'
import {Entry} from './Entry.js'
import {
  entryChildrenDir,
  entryFileName,
  entryFilepath,
  entryUrl,
  workspaceMediaDir
} from './EntryFilenames.js'
import {EntryPhase, EntryRow} from './EntryRow.js'
import {GraphRealm} from './Graph.js'
import {HttpError} from './HttpError.js'
import {createId} from './Id.js'
import {Mutation, MutationType} from './Mutation.js'
import {Root} from './Root.js'
import {Schema} from './Schema.js'
import {EntryUrlMeta, Type, TypeI} from './Type.js'
import {Workspace} from './Workspace.js'
import {isImage} from './media/IsImage.js'
import {createFileHash} from './util/ContentHash.js'
import {createEntryRow, entryParentPaths} from './util/EntryRows.js'
import {basename, extname, join, normalize} from './util/Paths.js'
import {slugify} from './util/Slugs.js'

export interface Transaction {
  (cms: CMS): Promise<Array<Mutation>>
}
export namespace Transaction {
  export async function commit(cms: CMS, tx: Array<Transaction>) {
    const mutations = await Promise.all(tx.map(task => task(cms)))
    const cnx = await cms.connection()
    return cnx.mutate(mutations.flat())
  }
}

export interface Operation {
  [Operation.Data]: Transaction
}

export class Operation {
  static readonly Data = Symbol.for('@alinea/Operation.Data')

  constructor(tx: Transaction) {
    this[Operation.Data] = tx
  }

  protected typeName(config: Config, type: TypeI) {
    const typeNames = Schema.typeNames(config.schema)
    const typeName = typeNames.get(type)!
    if (!typeName) throw new Error(`Type not found: ${type}`)
    return typeName
  }
}

export interface UploadOptions {
  createPreview?(blob: Blob): Promise<ImagePreviewDetails>
}

export class UploadOperation extends Operation {
  entryId = createId()
  private parentId?: string
  private workspace?: string
  private root?: string

  constructor(file: File | [string, Uint8Array], options: UploadOptions = {}) {
    super(async ({config, graph, connection}): Promise<Array<Mutation>> => {
      const fileName = Array.isArray(file) ? file[0] : file.name
      const body = Array.isArray(file) ? file[1] : await file.arrayBuffer()
      const cnx = await connection()
      const workspace = this.workspace ?? Object.keys(config.workspaces)[0]
      const root =
        this.root ?? Workspace.defaultMediaRoot(config.workspaces[workspace])
      const extension = extname(fileName)
      const path = slugify(basename(fileName, extension))
      const directory = workspaceMediaDir(config, workspace)
      const uploadLocation = join(directory, path + extension)
      const info = await cnx.prepareUpload(uploadLocation)
      const previewData = isImage(fileName)
        ? await options.createPreview?.(
            file instanceof Blob ? file : new Blob([body])
          )
        : undefined
      await fetch(info.upload.url, {
        method: info.upload.method ?? 'POST',
        body
      }).then(async result => {
        if (!result.ok)
          throw new HttpError(
            result.status,
            `Could not reach server for upload`
          )
      })
      const parent = this.parentId
        ? await graph.preferPublished.get(Entry({entryId: this.parentId}))
        : undefined
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
          entryId: this.entryId,
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
          entryId: this.entryId,
          url: info.previewUrl,
          file: info.location
        },
        {
          type: MutationType.Create,
          entryId: entry.entryId,
          file: entryFile,
          entry
        }
      ]
    })
  }

  setParent(parentId: string) {
    this.parentId = parentId
    return this
  }

  setWorkspace(workspace: string) {
    this.workspace = workspace
    return this
  }

  setRoot(root: string) {
    this.root = root
    return this
  }
}

export class DeleteOp extends Operation {
  constructor(protected entryId: string) {
    super(async ({config, graph}) => {
      const entry = await graph.preferPublished.get(
        Entry({entryId: this.entryId})
      )
      const parentPaths = entryParentPaths(config, entry)
      const file = entryFileName(config, entry, parentPaths)
      return [
        {
          type: MutationType.Remove,
          entryId: this.entryId,
          file
        }
      ]
    })
  }
}

export class EditOperation<Definition> extends Operation {
  private entryData?: Partial<Type.Infer<Definition>>
  private changePhase?: EntryPhase

  constructor(protected entryId: string) {
    super(async ({config, graph}) => {
      let realm: GraphRealm
      if (this.changePhase === EntryPhase.Draft) realm = graph.preferDraft
      else if (this.changePhase === EntryPhase.Archived)
        realm = graph.preferPublished
      else if (this.changePhase === EntryPhase.Published)
        realm = graph.preferDraft
      else realm = graph.preferPublished
      const entry = await realm.get(Entry({entryId: this.entryId}))
      const parent = entry.parent
        ? await graph.preferPublished.get(Entry({entryId: entry.parent}))
        : undefined
      const parentPaths = entryParentPaths(config, entry)

      const file = entryFileName(
        config,
        {...entry, phase: entry.phase},
        parentPaths
      )
      const type = config.schema[entry.type]
      const mutations: Array<Mutation> = []
      const createDraft = this.changePhase === EntryPhase.Draft
      if (createDraft)
        mutations.push({
          type: MutationType.Edit,
          entryId: this.entryId,
          file,
          entry: await createEntry(
            config,
            this.typeName(config, type),
            {
              ...entry,
              phase: EntryPhase.Draft,
              data: {...entry.data, ...this.entryData}
            },
            parent
          )
        })
      else if (this.entryData)
        mutations.push({
          type: MutationType.Patch,
          entryId: this.entryId,
          file,
          patch: this.entryData
        })
      switch (this.changePhase) {
        case EntryPhase.Published:
          mutations.push({
            type: MutationType.Publish,
            phase: entry.phase,
            entryId: this.entryId,
            file
          })
          break
        case EntryPhase.Archived:
          mutations.push({
            type: MutationType.Archive,
            entryId: this.entryId,
            file
          })
          break
      }
      return mutations
    })
  }

  set(entryData: Partial<Type.Infer<Definition>>) {
    this.entryData = {...this.entryData, ...entryData}
    return this
  }

  /*moveTo(workspace: string, root: string, parentId?: string) {
    throw new Error(`Not implemented`)
    return this
  }

  createAfter<Definition>(type: Type<Definition>) {
    throw new Error(`Not implemented`)
    return new CreateOp(type)
  }

  createBefore<Definition>(type: Type<Definition>) {
    throw new Error(`Not implemented`)
    return new CreateOp(type)
  }

  createChild<Definition>(type: Type<Definition>) {
    throw new Error(`Not implemented`)
    return new CreateOp(type)
  }*/

  draft() {
    this.changePhase = EntryPhase.Draft
    return this
  }

  archive() {
    this.changePhase = EntryPhase.Archived
    return this
  }

  publish() {
    this.changePhase = EntryPhase.Published
    return this
  }
}

export class CreateOperation<Definition> extends Operation {
  entryId = createId()
  private workspace?: string
  private root?: string
  private locale?: string | null
  private entryData: Partial<Type.Infer<Definition>> = {}
  private entryRow = async (cms: CMS) => {
    return createEntry(
      cms.config,
      this.typeName(cms.config, this.type),
      {entryId: this.entryId, data: this.entryData ?? {}},
      await this.parentRow?.(cms)
    )
  }

  constructor(
    protected type: Type<Definition>,
    protected parentRow?: (cms: CMS) => Promise<EntryRow>
  ) {
    super(async (cms): Promise<Array<Mutation>> => {
      const parent = await this.parentRow?.(cms)
      const {config} = cms
      const entry = await createEntry(
        config,
        this.typeName(config, type),
        {
          entryId: this.entryId,
          workspace: this.workspace,
          root: this.root,
          locale: this.locale,
          data: this.entryData ?? {}
        },
        parent
      )
      const parentPaths = entryParentPaths(config, entry)
      const file = entryFileName(config, entry, parentPaths)
      return [
        {
          type: MutationType.Create,
          entryId: this.entryId,
          file,
          entry: entry
        }
      ]
    })
  }

  setParent(parentId: string) {
    this.parentRow = async (cms: CMS) => {
      return cms.graph.preferPublished.get(Entry({entryId: parentId}))
    }
    return this
  }

  setWorkspace(workspace: string) {
    this.workspace = workspace
    return this
  }

  setRoot(root: string) {
    this.root = root
    return this
  }

  setLocale(locale: string | null) {
    this.locale = locale
    return this
  }

  set(entryData: Partial<Type.Infer<Definition>>) {
    this.entryData = {...this.entryData, ...entryData}
    return this
  }

  createChild<Definition>(type: Type<Definition>) {
    return new CreateOperation(type, this.entryRow)
  }
}

async function createEntry(
  config: Config,
  typeName: string,
  partial: Partial<EntryRow> = {title: 'Entry'},
  parent?: EntryRow
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
  const title = partial.data.title ?? partial.title ?? 'Entry'
  const phase = partial.phase ?? EntryPhase.Published
  const path = slugify(
    (phase === EntryPhase.Published && partial.data.path) ||
      (partial.path ?? title)
  )
  const entryData = {title, path, ...partial.data}
  const entryId = partial.entryId ?? createId()
  const i18nId = partial.i18nId ?? createId()
  const details = {
    entryId,
    phase,
    type: typeName,
    title,
    path,
    seeded: null,
    workspace: workspace,
    root: root,
    level: parent ? parent.level + 1 : 0,
    parent: parent?.entryId ?? null,
    locale,
    index: 'a0',
    i18nId,
    modifiedAt: 0,
    active: true,
    main: true,
    data: entryData,
    searchableText: Type.searchableText(type, entryData)
  }
  const parentPaths = parent?.childrenDir.split('/').filter(Boolean) ?? []
  const filePath = entryFilepath(config, details, parentPaths)
  const childrenDir = entryChildrenDir(config, details, parentPaths)
  const urlMeta: EntryUrlMeta = {
    locale,
    path,
    phase,
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
