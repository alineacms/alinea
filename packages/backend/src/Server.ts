import {
  accumulate,
  Config,
  createError,
  createId,
  Entry,
  entryFromDoc,
  Future,
  Hub,
  Media,
  outcome,
  WorkspaceConfig,
  Workspaces
} from '@alinea/core'
import {arrayBufferToHex} from '@alinea/core/util/ArrayBuffers'
import {base64} from '@alinea/core/util/Encoding'
import {generateKeyBetween} from '@alinea/core/util/FractionalIndexing'
import {basename, extname} from '@alinea/core/util/Paths'
import {crypto} from '@alinea/iso'
import sqlite from '@alinea/sqlite-wasm'
import {Cursor, Store} from '@alinea/store'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import * as Y from 'yjs'
import {Cache} from './Cache'
import {Data} from './Data'
import {Drafts} from './Drafts'
import {JsonLoader} from './loader/JsonLoader'
import {Pages} from './Pages'
import {Previews} from './Previews'
import {PreviewStore, previewStore} from './PreviewStore'
import {Storage} from './Storage'
import {parentUrl, walkUrl} from './util/EntryPaths'

type PagesOptions = {
  preview?: boolean
  previewToken?: string
}

export type ServerOptions<T extends Workspaces> = {
  config: Config<T>
  createStore: () => Promise<Store>
  drafts: Drafts
  target: Data.Target
  media: Data.Media
  previews: Previews
}

export class Server<T extends Workspaces = Workspaces> implements Hub<T> {
  preview: PreviewStore
  createStore: () => Promise<Store>

  constructor(public options: ServerOptions<T>) {
    this.createStore = options.createStore
    this.preview = previewStore({
      name: `preview for ${this.constructor.name}`,
      createCache: async () => {
        const {Database} = await sqlite()
        const original = await this.createStore()
        return new SqliteStore(
          new SqlJsDriver(new Database(original.export())),
          createId
        )
      },
      config: options.config,
      drafts: options.drafts
    })
  }

  get config(): Config<T> {
    return this.options.config
  }

  async entry(
    {id, stateVector}: Hub.EntryParams,
    ctx: Hub.Context
  ): Future<Entry.Detail | null> {
    const {config, drafts, previews} = this.options
    let draft = await drafts.get({id, stateVector}, ctx)
    if (draft) {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, draft)
      const isValidDraft = outcome.succeeds(() =>
        entryFromDoc(doc, config.type)
      )
      if (!isValidDraft) {
        console.log(`Removed invalid draft ${id}`)
        await drafts.delete({ids: [id]}, ctx)
        draft = undefined
      }
    }
    return outcome(async () => {
      const [preview, source] = await Promise.all([
        this.preview.getStore(ctx),
        this.createStore()
      ])
      const Parent = Entry.as('Parent')
      const Translation = Entry.as('Translation')
      const minimal = (entry: Cursor<Entry>) => ({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        workspace: entry.workspace,
        root: entry.root,
        url: entry.url,
        parent: entry.parent,
        i18n: entry.i18n
      })
      const data = preview.first(
        Entry.where(Entry.id.is(id)).select({
          entry: Entry.fields,
          translations: Translation.where(t =>
            t.i18n.id.is(Entry.i18n.id)
          ).select(minimal),
          parent: Parent.where(Parent.id.is(Entry.parent))
            .select(minimal)
            .first()
        })
      )
      const original = source.first(Entry.where(Entry.id.is(id)))
      return (
        data && {
          ...data,
          original,
          draft: draft && base64.stringify(draft),
          previewToken: await previews.sign({id})
        }
      )
    })
  }

  async query<T>(
    {cursor, source}: Hub.QueryParams<T>,
    ctx: Hub.Context
  ): Future<Array<T>> {
    return outcome(async () => {
      const create = source
        ? this.createStore
        : this.preview.getStore.bind(this.preview)
      const store = await create(ctx)
      return store.all(cursor)
    })
  }

  updateDraft({id, update}: Hub.UpdateParams, ctx: Hub.Context): Future<void> {
    const {drafts} = this.options
    return outcome(async () => {
      const instruction = await drafts.update({id, update}, ctx)
      await this.preview.applyUpdate(instruction)
    })
  }

  deleteDraft({id}: Hub.DeleteParams, ctx: Hub.Context): Future<boolean> {
    const {drafts} = this.options
    return outcome(async () => {
      await drafts.delete({ids: [id]}, ctx)
      await this.preview.deleteUpdate(id)
      const store = await this.preview.getStore(ctx)
      // Do we still have an entry after removing the draft?
      return Boolean(store.first(Entry.where(Entry.id.is(id))))
    })
  }

  listDrafts({workspace}: Hub.ListParams, ctx: Hub.Context) {
    return outcome(async () => {
      const store = await this.preview.getStore(ctx)
      const drafts = await accumulate(this.drafts.updates({}, ctx))
      const ids = drafts.map(({id}) => id)
      const inWorkspace = store.all(
        Entry.where(Entry.workspace.is(workspace))
          .where(Entry.id.isIn(ids))
          .select(Entry.id)
      )
      return inWorkspace.map(id => ({id}))
    })
  }

  publishEntries({entries}: Hub.PublishParams, ctx: Hub.Context): Future<void> {
    const {config, drafts, target} = this.options
    function applyPublish(store: Store) {
      Cache.applyPublish(store, config, entries)
      return store
    }
    console.log(`Publishing ${entries.map(e => e.id).join(', ')}`)
    return outcome(async () => {
      const create = this.createStore
      const current = await create()
      const changes = await Storage.publishChanges(
        config,
        current,
        JsonLoader,
        entries,
        false
      )
      await target.publish({changes}, ctx)
      const ids = entries.map(entry => entry.id)
      await drafts.delete({ids}, ctx)
      if (process.env.NODE_ENV !== 'development') applyPublish(current)
      // this.createStore = () => create().then(applyPublish)
      await this.preview.applyPublish(entries)
    })
  }

  uploadFile(
    {workspace, root, ...file}: Hub.UploadParams,
    ctx: Hub.Context
  ): Future<Media.File> {
    return outcome(async () => {
      const store = await this.preview.getStore(ctx)
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
      const location = await media.upload({workspace, root, ...file}, ctx)
      const extension = extname(location)
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
        title: basename(file.path, extension),
        url: file.path.toLowerCase(),
        path: basename(file.path),
        location,
        extension: extension,
        size: file.buffer.byteLength,
        hash: arrayBufferToHex(
          await crypto.subtle.digest('SHA-256', file.buffer)
        ),
        width: file.width,
        height: file.height,
        averageColor: file.averageColor,
        blurHash: file.blurHash,
        preview: file.preview
      }
      await this.publishEntries({entries: [entry]}, ctx)
      return entry
    })
  }

  get drafts() {
    return this.options.drafts
  }

  loadPages<K extends keyof T>(workspaceKey: K, options: PagesOptions = {}) {
    const workspace = this.config.workspaces[workspaceKey]
    const store = options.previewToken
      ? async () => {
          const {id} = await this.parsePreviewToken(options.previewToken!)
          return this.preview.getStore({preview: id})
        }
      : options.preview
      ? () => this.preview.getStore({})
      : this.createStore
    return new Pages<T[K] extends WorkspaceConfig<infer W> ? W : any>(
      workspace,
      store
    )
  }

  async parsePreviewToken(token: string): Promise<{id: string; url: string}> {
    const {previews} = this.options
    const [tokenData, err] = await outcome(() => previews.verify(token))
    if (!tokenData) throw createError(400, `Incorrect token: ${err}`)
    const {id} = tokenData
    const store = await this.preview.getStore({preview: id})
    await this.preview.fetchUpdate(id, {preview: id})
    const entry = store.first(
      Entry.where(Entry.id.is(id)).select({id: Entry.id, url: Entry.url})
    )
    if (!entry) throw createError(404, 'Entry not found')
    return entry
  }
}
