import {createFileHash} from 'alinea/backend/util/ContentHash'
import PLazy from 'p-lazy'
import {CMS} from './CMS.js'
import {Config} from './Config.js'
import {Connection} from './Connection.js'
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
import {MediaFile} from './media/MediaSchema.js'
import {createEntryRow, entryParentPaths} from './util/EntryRows.js'
import {basename, extname, join, normalize} from './util/Paths.js'
import {slugify} from './util/Slugs.js'

export class Transaction {
  commited = false
  cnx: Promise<Connection>
  constructor(
    protected cms: CMS,
    protected tasks: Array<(cms: CMS) => Promise<Array<Mutation>>> = []
  ) {
    this.cnx = this.cms.connection()
  }

  get graph() {
    return this.cms.graph
  }

  get config() {
    return this.cms.config
  }

  addTask(task: () => Promise<Array<Mutation>>) {
    this.tasks.push(task)
    return this
  }

  async commit() {
    if (this.commited) throw new Error(`Transaction already commited`)
    this.commited = true
    const mutations = await Promise.all(this.tasks.map(task => task(this.cms)))
    const cnx = await this.cnx
    const result = await cnx.mutate(mutations.flat())
    return result
  }
}

export class Op {
  constructor(protected tx: Transaction) {}

  create<Definition>(type: Type<Definition>) {
    return new CreateOp<Definition>(this.tx, type)
  }

  edit<Definition>(entryId: string, type?: Type<Definition>) {
    return new EditOp<Definition>(this.tx, entryId)
  }

  delete(entryId: string) {
    return new DeleteOp(this.tx, entryId)
  }

  upload(fileName: string, data: Uint8Array) {
    return new UploadOp(this.tx, fileName, data)
  }

  async commit() {
    await this.tx.commit()
  }
}

export class UploadOp extends Op {
  entryId = createId()
  parentId?: string
  workspace?: string
  root?: string

  constructor(tx: Transaction, fileName: string, data: Uint8Array) {
    super(
      tx.addTask(async (): Promise<Array<Mutation>> => {
        const {config, graph} = tx
        const cnx = await tx.cnx
        const workspace = this.workspace ?? Object.keys(config.workspaces)[0]
        const root =
          this.root ?? Workspace.defaultMediaRoot(config.workspaces[workspace])
        const extension = extname(fileName)
        const path = slugify(basename(fileName, extension))
        const directory = workspaceMediaDir(config, workspace)
        const file = join(directory, path + extension)
        const info = await cnx.prepareUpload(file)
        await fetch(info.upload.url, {
          method: info.upload.method ?? 'POST',
          body: data
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
        const hash = await createFileHash(data)
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
          size: data.byteLength,
          hash
          /*width: upload.width,
          height: upload.height,
          averageColor: upload.averageColor,
          focus: upload.focus,
          thumbHash: upload.thumbHash,
          preview: upload.preview*/
        }
        const entry = await createEntry(
          config,
          MediaFile,
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
    )
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

export class DeleteOp extends Op {
  constructor(tx: Transaction, protected entryId: string) {
    super(
      tx.addTask(async () => {
        const {config, graph} = tx
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
    )
  }
}

export class EditOp<Definition> extends Op {
  entryData?: Partial<Type.Infer<Definition>>
  changePhase?: EntryPhase

  constructor(tx: Transaction, protected entryId: string) {
    super(
      tx.addTask(async () => {
        const {config, graph} = tx
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
              type,
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
    )
  }

  set(entryData: Partial<Type.Infer<Definition>>) {
    this.entryData = {...this.entryData, ...entryData}
    return this
  }

  /*moveTo(workspace: string, root: string, parentId?: string) {
    throw new Error(`Not implemented`)
    return this
  }

  setParent(parentId: string) {
    throw new Error(`Not implemented`)
    return this
  }

  createAfter<Definition>(type: Type<Definition>) {
    throw new Error(`Not implemented`)
    return new CreateOp(this.tx, type)
  }

  createBefore<Definition>(type: Type<Definition>) {
    throw new Error(`Not implemented`)
    return new CreateOp(this.tx, type)
  }

  createChild<Definition>(type: Type<Definition>) {
    throw new Error(`Not implemented`)
    return new CreateOp(this.tx, type)
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

export class CreateOp<Definition> extends Op {
  entryId = createId()
  workspace?: string
  root?: string
  locale?: string | null
  entryData: Partial<Type.Infer<Definition>> = {}
  entryRow = PLazy.from(async () => {
    return createEntry(
      this.tx.config,
      this.type,
      {entryId: this.entryId, data: this.entryData ?? {}},
      await this.parentRow
    )
  })

  constructor(
    protected tx: Transaction,
    protected type: Type<Definition>,
    protected parentRow?: Promise<EntryRow>
  ) {
    super(
      tx.addTask(async (): Promise<Array<Mutation>> => {
        const {config} = tx
        const parent = await this.parentRow
        const entry = await createEntry(
          config,
          this.type,
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
    )
  }

  setParent(parentId: string) {
    this.parentRow = PLazy.from(async () => {
      return this.tx.graph.preferPublished.get(Entry({entryId: parentId}))
    })
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
    return new CreateOp(this.tx, type, this.entryRow)
  }
}

async function createEntry(
  config: Config,
  type: TypeI,
  partial: Partial<EntryRow> = {title: 'Entry'},
  parent?: EntryRow
): Promise<EntryRow> {
  const typeNames = Schema.typeNames(config.schema)
  const typeName = typeNames.get(type)!
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
