import {
  Config,
  Connection,
  Entry,
  EntryPhase,
  Workspace,
  createId
} from 'alinea/core'
import {Graph} from 'alinea/core/Graph'
import {Mutation, MutationType} from 'alinea/core/Mutation'
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

  resolve(params: Connection.ResolveParams) {
    const {resolveDefaults} = this.options
    return this.resolver.resolve({...resolveDefaults, ...params})
  }

  async mutate(mutations: Array<Mutation>): Promise<void> {
    const {target} = this.options
    const changes = this.changes.create(mutations)
    await target.publishChanges({changes}, this.context)
  }

  previewToken(): Promise<string> {
    const {previews} = this.options
    const user = this.context.user
    if (!user) return previews.sign({anonymous: true})
    return previews.sign({sub: user.sub})
  }

  async uploadFile({
    workspace,
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
    const {mediaDir} = Workspace.data(config.workspaces[workspace])
    const prefix = mediaDir && normalize(mediaDir)
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
      Date.now(),
      EntryPhase.Published,
      new Uint8Array(file.buffer)
    )
    const parent = await this.graph.preferDraft.maybeGet(
      Entry({entryId: parentId})
    )
    const prev = await this.graph.preferDraft.maybeGet(
      Entry({parent: parentId})
    )
    const filePath = ''
    if (filePath === '')
      throw new Error(`Todo: Filepath needs calculation here`)
    const entry: Media.File = {
      entryId,
      type: 'MediaFile',
      url: (parent ? parent.url : '/') + file.path.toLowerCase(),
      title: basename(file.path, extension),
      path: basename(file.path.toLowerCase()),
      parent: parentId ?? null,
      workspace,
      root,
      phase: EntryPhase.Published,
      seeded: false,
      modifiedAt: Date.now(),
      searchableText: '',
      index: generateKeyBetween(null, prev?.index ?? null),
      locale: null,
      i18nId: entryId,

      level: parent ? parent.level + 1 : 0,
      parentDir: '',
      filePath,
      childrenDir: '',
      contentHash,
      active: true,
      main: true,
      data: {
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
    await this.mutate([
      {
        type: MutationType.FileUpload,
        entryId: entry.entryId,
        file: filePath,
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
