import {
  Auth,
  Config,
  createError,
  createId,
  Entry,
  entryFromDoc,
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
import jwt from 'jsonwebtoken'
import {posix as path} from 'path'
import * as Y from 'yjs'
import {Cache} from './Cache'
import {Data} from './Data'
import {Drafts} from './Drafts'
import {PreviewStore, previewStore} from './PreviewStore'
import {createServerRouter} from './router/ServerRouter'
import {finishResponse} from './util/FinishResponse'
import {parentUrl, walkUrl} from './util/Urls'

export type ServerOptions<T extends Workspaces> = {
  config: Config<T>
  createStore: () => Promise<Store>
  drafts: Drafts
  target: Data.Target
  media: Data.Media
  jwtSecret: string
  auth?: Auth.Server
}

export class Server<T extends Workspaces = Workspaces> implements Hub<T> {
  config: Config<T>
  app = express()
  preview: PreviewStore
  createStore: () => Promise<Store>

  constructor(public options: ServerOptions<T>) {
    this.config = options.config
    this.app.use(createServerRouter(this))
    this.createStore = options.createStore
    this.preview = previewStore(
      () => this.createStore(),
      options.config,
      options.drafts
    )
  }

  async entry(
    id: string,
    stateVector?: Uint8Array
  ): Future<Entry.Detail | null> {
    const {config, drafts, jwtSecret} = this.options
    let draft = await drafts.get(id, stateVector)
    if (draft) {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, draft)
      const isValidDraft = outcome.succeeds(() => entryFromDoc(config, doc))
      if (!isValidDraft) {
        console.log(`Removed invalid draft ${id}`)
        await drafts.delete([id])
        draft = undefined
      }
    }
    return outcome(async () => {
      const store = await this.preview.getStore()
      const entry = store.first(Entry.where(Entry.id.is(id)))
      return (
        entry && {
          entry,
          draft: draft && encode(draft),
          previewToken: jwt.sign({id}, jwtSecret)
        }
      )
    })
  }

  async query<T>(cursor: Cursor<T>): Future<Array<T>> {
    return outcome(async () => {
      const store = await this.preview.getStore()
      return store.all(cursor)
    })
  }

  updateDraft(id: string, update: Uint8Array): Future<void> {
    const {drafts} = this.options
    return outcome(async () => {
      const instruction = await drafts.update(id, update)
      await this.preview.applyUpdate(instruction)
    })
  }

  deleteDraft(id: string): Future<void> {
    const {drafts} = this.options
    return outcome(async () => {
      await this.preview.deleteUpdate(id)
      return drafts.delete([id])
    })
  }

  publishEntries(entries: Array<Entry>): Future<void> {
    const {config, drafts, target} = this.options
    function applyPublish(store: Store) {
      Cache.applyPublish(store, config, entries)
      return store
    }
    return outcome(async () => {
      await target.publish(entries)
      const ids = entries.map(entry => entry.id)
      await drafts.delete(ids)
      const create = this.createStore
      this.createStore = () => create().then(applyPublish)
      await this.preview.deleteUpdates(ids)
    })
  }

  uploadFile(
    workspace: string,
    root: string,
    file: Hub.Upload
  ): Future<Media.File> {
    return outcome(async () => {
      const store = await this.preview.getStore()
      const id = createId()
      const {media} = this.options
      const parents = walkUrl(parentUrl(file.path)).map(url => {
        const parent = store.first(
          Entry.where(Entry.workspace.is(workspace))
            .where(Entry.root.is(root))
            .where(Entry.url.is(url))
            .select({id: Entry.id})
        )
        if (!parent) throw createError(400, `Parent not found: ${url}`)
        return parent.id
      })
      const parent = parents[parents.length - 1]
      if (!parent) throw createError(400, `Parent not found: "${file.path}"`)
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
        averageColor: file.averageColor,
        blurHash: file.blurHash
      }
      await this.publishEntries([entry])
      return entry
    })
  }

  get drafts() {
    return this.options.drafts
  }

  async parsePreviewToken(
    previewToken: string
  ): Promise<{id: string; url: string}> {
    const {jwtSecret} = this.options
    const {id} = jwt.verify(previewToken, jwtSecret) as {id: string}
    const store = await this.preview.getStore()
    await this.preview.fetchUpdate(id)
    const entry = store.first(
      Entry.where(Entry.id.is(id)).select({id: Entry.id, url: Entry.url})
    )
    if (!entry) throw createError(404, 'Entry not found')
    return entry
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
