import {
  accumulate,
  Auth,
  Config,
  createError,
  createId,
  Entry,
  future,
  Future,
  Hub,
  Media,
  outcome,
  Workspaces
} from '@alinea/core'
import {generateKeyBetween} from '@alinea/core/util/FractionalIndexing'
import {Cursor, Store} from '@alinea/store'
import {encode} from 'base64-arraybuffer'
import crypto from 'crypto'
import express from 'express'
import {
  createServer as createHttpServer,
  IncomingMessage,
  ServerResponse
} from 'http'
import {posix as path} from 'path'
import {Cache} from './Cache'
import {Data} from './Data'
import {Drafts} from './Drafts'
import {createServerRouter} from './router/ServerRouter'
import {finishResponse} from './util/FinishResponse'
import {parentUrl, walkUrl} from './util/Urls'

export type ServerOptions<T extends Workspaces> = {
  config: Config<T>
  store: Store
  drafts: Drafts
  target: Data.Target
  media: Data.Media
  auth?: Auth.Server
}

type UpdatesCache = {
  lastFetched: number
  updates: Promise<Array<Drafts.Update>>
}

export class Server<T extends Workspaces = Workspaces> implements Hub<T> {
  config: Config<T>
  app = express()
  updateCache: UpdatesCache | undefined = undefined

  constructor(public options: ServerOptions<T>) {
    this.config = options.config
    this.app.use(createServerRouter(this))
  }

  private async fetchUpdates(): Promise<Array<Drafts.Update>> {
    const {drafts} = this.options
    if (this.updateCache) {
      const {lastFetched, updates} = this.updateCache
      const minutesAgo = (Date.now() - lastFetched) / 1000 / 60
      const isExpired = minutesAgo > 1
      if (!isExpired) return updates
    }
    const updates = accumulate(drafts.updates())
    this.updateCache = {lastFetched: Date.now(), updates}
    return updates
  }

  // Todo: we could cache every statement in the transaction or
  // keep a second in memory db running
  private async queryWithDrafts<T>(run: () => T): Promise<T> {
    const {config, store} = this.options
    const updates = await this.fetchUpdates()
    let result: T | undefined
    try {
      return store.transaction(() => {
        Cache.applyUpdates(store, config, updates)
        result = run()
        throw 'rollback'
      })
    } catch (e) {
      if (e === 'rollback') return result!
      throw e
    }
  }

  async entry(
    id: string,
    stateVector?: Uint8Array
  ): Future<Entry.Detail | null> {
    const {store, drafts} = this.options
    const draft = await drafts.get(id, stateVector)
    return future(
      this.queryWithDrafts(() => {
        const entry = store.first(Entry.where(Entry.id.is(id)))
        return (
          entry && {
            entry,
            draft: draft && encode(draft)
          }
        )
      })
    )
  }

  async query<T>(cursor: Cursor<T>): Future<Array<T>> {
    const {config, store, drafts} = this.options
    return future(
      this.queryWithDrafts(() => {
        return store.all(cursor)
      })
    )
  }

  updateDraft(id: string, update: Uint8Array): Future<void> {
    const {drafts} = this.options
    return outcome(async () => {
      const instruction = await drafts.update(id, update)
      if (!this.updateCache) await this.fetchUpdates()
      const cache = this.updateCache!
      // Always add the update instruction to the cache because strong
      // consistency is not guaranteed for every drafts implementation
      this.updateCache = {
        ...cache,
        updates: cache.updates.then(res => [...res, instruction])
      }
    })
  }

  deleteDraft(id: string): Future<void> {
    const {drafts} = this.options
    return future(drafts.delete([id]))
  }

  publishEntries(entries: Array<Entry>): Future<void> {
    const {store, config, drafts, target} = this.options
    return outcome(async () => {
      await target.publish(entries)
      // Todo: This makes updates instantly available but should be configurable
      // Todo: if there's another instance running it won't have the drafts or
      // these changes so it would show the old data, so maybe we should always
      // hang on to drafts?
      Cache.applyPublish(store, config, entries)
      await drafts.delete(entries.map(entry => entry.id))
    })
  }

  uploadFile(
    workspace: string,
    root: string,
    file: Hub.Upload
  ): Future<Media.File> {
    const {store, drafts, target} = this.options
    return outcome(async () => {
      const id = createId()
      const {media} = this.options
      const parentPath = path.dirname(file.path)
      const parents = walkUrl(parentUrl(parentPath)).map(url => {
        const parent = store.first(
          Entry.where(Entry.workspace.is(workspace))
            .where(Entry.root.is(root))
            .where(Entry.url.is(url))
            .select({id: Entry.id})
        )
        if (!parent) throw createError(400, 'Parent not found')
        return parent.id
      })
      const parent = parents[parents.length - 1]
      if (!parent) throw createError(400, `Parent not found: "${parentUrl}"`)
      const location = await media.upload(workspace as string, file)
      const extension = path.extname(location)
      const prev = store.first(
        Entry.where(Entry.workspace.is(workspace))
          .where(Entry.root.is(root))
          .where(Entry.parent.is(parent))
      )
      const entry: Media.File = {
        id,
        type: 'File',
        index: generateKeyBetween(null, prev?.index || null),
        workspace: workspace as string,
        root: root as string,
        parent: parent,
        parents,
        title: path.basename(file.path, extension),
        url: file.path,
        location,
        extension: extension,
        size: file.buffer.byteLength,
        hash: crypto
          .createHash('md5')
          .update(Buffer.from(file.buffer))
          .digest('hex'),
        preview: file.preview,
        averageColor: file.color
      }
      await this.publishEntries([entry])
      return entry
    })
  }

  respond = (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    this.app(req, res)
    // Next.js expects us to return a promise that resolves when we're finished
    // with the response.
    return finishResponse(res)
  }

  listen(port: number) {
    return createHttpServer(this.respond).listen(port)
  }
}

export function createServer<T extends Workspaces>(
  options: ServerOptions<T>
): Server<T> {
  return new Server(options)
}
