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
  slugify
} from '@alinea/core'
import {arrayBufferToHex} from '@alinea/core/util/ArrayBuffers'
import {base64} from '@alinea/core/util/Encoding'
import {generateKeyBetween} from '@alinea/core/util/FractionalIndexing'
import {Logger} from '@alinea/core/util/Logger'
import {
  basename,
  dirname,
  extname,
  join,
  normalize
} from '@alinea/core/util/Paths'
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

type PagesOptions = {
  preview?: boolean
  previewToken?: string
}

export type ServerOptions<T> = {
  config: Config<T>
  createStore: () => Promise<Store>
  drafts: Drafts
  target: Data.Target
  media: Data.Media
  previews: Previews
  // After publishing entries, also apply that change to the memory db
  // this is to be avoided during development as the publish changes will
  // be picked up by the file watcher
  applyPublish?: boolean
}

export class Server<T = any> implements Hub<T> {
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

  createContext() {
    return {
      logger: new Logger(this.constructor.name)
    }
  }

  get config(): Config<T> {
    return this.options.config
  }

  async entry(
    {id, stateVector}: Hub.EntryParams,
    ctx: Hub.Context = this.createContext()
  ): Future<Entry.Detail | null> {
    const {config, drafts, previews} = this.options
    const end = ctx.logger.time('Get draft', true)
    let draft = await drafts.get({id, stateVector}, ctx)
    end()
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
        alinea: entry.alinea
      })
      const data = preview.first(
        Entry.where(Entry.id.is(id)).select({
          entry: Entry.fields,
          translations: Translation.where(t =>
            t.alinea.i18n.id.is(Entry.alinea.i18n.id)
          ).select(minimal),
          parent: Parent.where(Parent.id.is(Entry.alinea.parent))
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
    ctx: Hub.Context = this.createContext()
  ): Future<Array<T>> {
    return outcome(async () => {
      const create = source
        ? this.createStore
        : this.preview.getStore.bind(this.preview)
      const store = await create(ctx)
      return store.all(cursor)
    })
  }

  updateDraft(
    {id, update}: Hub.UpdateParams,
    ctx: Hub.Context = this.createContext()
  ): Future<void> {
    const {drafts} = this.options
    return outcome(async () => {
      const end = ctx.logger.time('Update draft', true)
      const instruction = await drafts.update({id, update}, ctx)
      end()
      await this.preview.applyUpdate(instruction)
    })
  }

  deleteDraft(
    {id}: Hub.DeleteParams,
    ctx: Hub.Context = this.createContext()
  ): Future<boolean> {
    const {drafts} = this.options
    return outcome(async () => {
      const end = ctx.logger.time('Delete draft', true)
      await drafts.delete({ids: [id]}, ctx)
      end()
      await this.preview.deleteUpdate(id)
      const store = await this.preview.getStore(ctx)
      // Do we still have an entry after removing the draft?
      return Boolean(store.first(Entry.where(Entry.id.is(id))))
    })
  }

  listDrafts(
    {workspace}: Hub.ListParams,
    ctx: Hub.Context = this.createContext()
  ) {
    return outcome(async () => {
      const store = await this.preview.getStore(ctx)
      const end = ctx.logger.time('Fetch draft updates', true)
      const drafts = await accumulate(this.drafts.updates({}, ctx))
      end()
      const ids = drafts.map(({id}) => id)
      const inWorkspace = store.all(
        Entry.where(Entry.alinea.workspace.is(workspace))
          .where(Entry.id.isIn(ids))
          .select(Entry.id)
      )
      return inWorkspace.map(id => ({id}))
    })
  }

  publishEntries(
    {entries}: Hub.PublishParams,
    ctx: Hub.Context = this.createContext()
  ): Future<void> {
    const {config, drafts, target, applyPublish = true} = this.options
    function applyEntriesTo(store: Store) {
      Cache.applyPublish(store, config, entries)
      return store
    }
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
      if (applyPublish) {
        applyEntriesTo(current)
        this.createStore = () => create().then(applyEntriesTo)
      }
      await this.preview.applyPublish(entries)
    })
  }

  uploadFile(
    {workspace, root, parentId, ...file}: Hub.UploadParams,
    ctx: Hub.Context = this.createContext()
  ): Future<Media.File> {
    const {config} = this.options
    return outcome(async () => {
      const store = await this.preview.getStore(ctx)
      const id = createId()
      const {media} = this.options
      const parents = !parentId
        ? []
        : store
            .first(Entry.where(Entry.id.is(parentId)).select(Entry.parents))!
            .concat(parentId)
      const dir = dirname(file.path)
      const extension = extname(file.path)
      const name = basename(file.path, extension)
      const fileName = `${slugify(name)}.${createId()}${extension}`
      const {mediaDir} = config.workspaces[workspace]
      const prefix = mediaDir && normalize(mediaDir)
      const fileLocation = join(prefix, dir, fileName)

      let location = await media.upload(
        {fileLocation, buffer: file.buffer},
        ctx
      )

      // We'll strip the media dir off the location we received. We don't want
      // this information to be saved to disk because it would be impractical
      // to ever refactor to another directory.
      if (prefix && location.startsWith(prefix))
        location = location.slice(prefix.length)

      const prev = store.first(
        Entry.where(Entry.alinea.workspace.is(workspace))
          .where(Entry.alinea.root.is(root))
          .where(Entry.alinea.parent.is(parentId))
      )
      const entry: Media.File = {
        id,
        type: 'File',
        url: file.path.toLowerCase(),
        title: basename(file.path, extension),
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
        preview: file.preview,
        alinea: {
          index: generateKeyBetween(null, prev?.alinea.index || null),
          workspace: workspace as string,
          root: root as string,
          parent: parentId,
          parents
        }
      }
      await this.publishEntries({entries: [entry]}, ctx)
      return entry
    })
  }

  get drafts() {
    return this.options.drafts
  }

  loadPages(options: PagesOptions = {}): Pages<T> {
    const {config} = this.options
    const logger = new Logger('Load pages')
    const store = options.previewToken
      ? async () => {
          const {id} = await this.parsePreviewToken(
            options.previewToken!,
            logger
          )
          return this.preview.getStore({preview: id, logger})
        }
      : options.preview
      ? () => this.preview.getStore({logger})
      : this.createStore
    return new Pages<T>(config.schema, store)
  }

  async parsePreviewToken(
    token: string,
    logger: Logger = new Logger('Parse preview token')
  ): Promise<{id: string; url: string}> {
    const {previews} = this.options
    const [tokenData, err] = await outcome(() => previews.verify(token))
    if (!tokenData) throw createError(400, `Incorrect token: ${err}`)
    const {id} = tokenData
    const store = await this.preview.getStore({preview: id, logger})
    await this.preview.fetchUpdate(id, {preview: id, logger})
    const entry = store.first(
      Entry.where(Entry.id.is(id)).select({id: Entry.id, url: Entry.url})
    )
    if (!entry) throw createError(404, 'Entry not found')
    return entry
  }
}
