import {
  Config,
  Connection,
  Entry,
  EntryPhase,
  EntryRow,
  Workspace,
  createId
} from 'alinea/core'
import {Graph} from 'alinea/core/Graph'
import {Realm} from 'alinea/core/pages/Realm'
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
import {ChangeSet} from './data/ChangeSet.js'
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

  constructor(
    public options: ServerOptions,
    public context: Connection.Context
  ) {
    this.db = new Database(options.store, options.config)
    this.resolver = new Resolver(options.store, options.config.schema)
    this.graph = new Graph(this.options.config, params => {
      return this.resolve({
        ...params,
        realm: Realm.PreferDraft
      })
    })
  }

  // Api

  resolve(params: Connection.ResolveParams) {
    const {resolveDefaults} = this.options
    return this.resolver.resolve({...resolveDefaults, ...params})
  }

  previewToken(): Promise<string> {
    const {previews} = this.options
    const user = this.context.user
    if (!user) return previews.sign({anonymous: true})
    return previews.sign({sub: user.sub})
  }

  async saveDraft(entry: EntryRow): Promise<void> {
    const {target} = this.options
    const changes = await ChangeSet.create(
      this.db,
      [entry],
      EntryPhase.Draft,
      target.canRename
    )
    await target.publishChanges({changes}, this.context)
  }

  async publishDrafts(entries: Array<EntryRow>): Promise<void> {
    const {target} = this.options
    const changes = await ChangeSet.create(
      this.db,
      entries,
      EntryPhase.Published,
      target.canRename
    )
    await target.publishChanges({changes}, this.context)
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
      EntryPhase.Published,
      new Uint8Array(file.buffer)
    )
    const parent = await this.graph.maybeGet(Entry({entryId: parentId}))
    const prev = await this.graph.maybeGet(Entry({parent: parentId}))
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
      i18nId: null,

      level: parent ? parent.level + 1 : 0,
      parentDir: '',
      filePath: '',
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
        blurHash: file.thumbHash,
        preview: file.preview
      }
    }
    await this.publishDrafts([entry])
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
