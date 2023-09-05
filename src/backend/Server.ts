import {
  Config,
  Connection,
  Entry,
  EntryPhase,
  HttpError,
  Workspace,
  createId
} from 'alinea/core'
import {entryFilepath} from 'alinea/core/EntryFilenames'
import {Graph} from 'alinea/core/Graph'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {
  basename,
  dirname,
  extname,
  join,
  normalize
} from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import {Database} from './Database.js'
import {Media} from './Media.js'
import {Previews} from './Previews'
import {ResolveDefaults, Resolver} from './Resolver.js'
import {Store} from './Store.js'
import {Target} from './Target.js'
import {ChangeSetCreator} from './data/ChangeSet.js'
import {AlineaMeta} from './db/AlineaMeta.js'
import {createContentHash} from './util/ContentHash.js'

export interface PreviewOptions {
  preview?: boolean
  previewToken?: string
}

export type ServerOptions = {
  config: Config
  store: Store
  target: Target
  media: Media
  previews: Previews
  resolveDefaults?: ResolveDefaults
}

export class Server implements Connection {
  db: Database
  resolver: Resolver
  protected graph: Graph
  changes: ChangeSetCreator

  constructor(
    public options: ServerOptions,
    public context: Connection.Context
  ) {
    this.db = new Database(options.store, options.config)
    this.resolver = new Resolver(options.store, options.config.schema)
    this.graph = new Graph(this.options.config, this.resolve)
    this.changes = new ChangeSetCreator(options.config)
  }

  // Api

  resolve = (params: Connection.ResolveParams) => {
    const {resolveDefaults} = this.options
    return this.resolver.resolve({...resolveDefaults, ...params})
  }

  async mutate(mutations: Array<Mutation>): Promise<void> {
    const {target} = this.options
    const changes = this.changes.create(mutations)
    for (const mutation of mutations) {
      if (mutation.type === MutationType.Remove) {
        const file = await this.graph.preferDraft.maybeGet(
          MediaFile()
            .where(Entry.entryId.is(mutation.entryId))
            .select({
              location: MediaFile.location,
              entryId: Entry.entryId,
              workspace: Entry.workspace,
              root: Entry.root,
              locale: Entry.locale,
              path: Entry.path,
              phase: Entry.phase,
              parentPaths({parents}) {
                return parents().select(Entry.path)
              }
            })
        )
      }
    }
    await target.mutate({mutations: changes}, this.context)
  }

  previewToken(): Promise<string> {
    const {previews} = this.options
    const user = this.context.user
    if (!user) return previews.sign({anonymous: true})
    return previews.sign({sub: user.sub})
  }

  async deleteFile(entryId: string): Promise<void> {
    const {media} = this.options
    const entry = await this.graph.preferDraft.maybeGet(
      MediaFile()
        .where(Entry.entryId.is(entryId))
        .select({
          location: MediaFile.location,
          entryId: Entry.entryId,
          workspace: Entry.workspace,
          root: Entry.root,
          locale: Entry.locale,
          path: Entry.path,
          phase: Entry.phase,
          parentPaths({parents}) {
            return parents().select(Entry.path)
          }
        })
    )
    if (!entry) throw new HttpError(404, 'Not found')
    await this.mutate([
      {
        type: MutationType.Remove,
        entryId: entry.entryId,
        file: entryFilepath(this.options.config, entry, entry.parentPaths)
      }
    ])
    await media.delete({location: entry.location}, this.context)
  }

  async uploadFile({
    workspace: workspaceName,
    root,
    parentId,
    ...file
  }: Connection.UploadParams): Promise<Media.File> {
    const {media, config} = this.options
    const entryId = createId()
    const dir = dirname(file.path)
    const extension = extname(file.path)
    const name = basename(file.path, extension)
    const fileName = `${slugify(name)}.${createId()}${extension}`
    const workspace = Workspace.data(config.workspaces[workspaceName])
    const prefix = workspace.mediaDir && normalize(workspace.mediaDir)
    const fileLocation = join(prefix, dir, fileName)

    let location = await media.upload(
      {fileLocation, buffer: file.buffer},
      this.context
    )

    // We'll strip the media dir off the location we received. We don't want
    // this information to be saved to disk because it would be impractical
    // to ever refactor to another directory.
    if (prefix && location.startsWith(prefix))
      location = location.slice(prefix.length)

    const contentHash = await createContentHash(
      EntryPhase.Published,
      new Uint8Array(file.buffer)
    )
    const parent = await this.graph.preferDraft.maybeGet(
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
    const prev = await this.graph.preferDraft.maybeGet(
      Entry({parent: parentId})
    )
    const entryLocation = {
      workspace: workspaceName,
      root,
      locale: null,
      path: basename(file.path.toLowerCase()),
      phase: EntryPhase.Published
    }

    const filePath = entryFilepath(
      config,
      entryLocation,
      parent ? parent.parentPaths.concat(parent.path) : []
    )

    const parentDir = dirname(filePath)

    const entry: Media.File = {
      ...entryLocation,
      parent: parent?.entryId ?? null,
      entryId,
      type: 'MediaFile',
      url: (parent ? parent.url : '/') + file.path.toLowerCase(),
      title: basename(file.path, extension),
      seeded: false,
      modifiedAt: Date.now(),
      searchableText: '',
      index: generateKeyBetween(null, prev?.index ?? null),
      i18nId: entryId,

      level: parent ? parent.level + 1 : 0,
      parentDir: parentDir,
      filePath,
      childrenDir: filePath.slice(0, -extension.length),
      contentHash,
      active: true,
      main: true,
      data: {
        title: basename(file.path, extension),
        location,
        extension: extension.toLowerCase(),
        size: file.buffer.byteLength,
        hash: contentHash,
        width: file.width,
        height: file.height,
        averageColor: file.averageColor,
        thumbHash: file.thumbHash,
        preview: file.preview
      }
    }
    const entryFile = join(workspace.source, entry.root, entry.filePath)
    await this.mutate([
      {
        type: MutationType.FileUpload,
        entryId: entry.entryId,
        file: entryFile,
        entry
      }
    ])
    return entry
  }

  // Syncable

  versionIds() {
    return this.db.versionIds()
  }

  updates(request: AlineaMeta) {
    return this.db.updates(request)
  }
}
