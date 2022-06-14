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
import {generateKeyBetween} from '@alinea/core/util/FractionalIndexing'
import {basename, extname} from '@alinea/core/util/Paths'
import {crypto} from '@alinea/iso'
import {Cursor, Store} from '@alinea/store'
import {encode} from 'base64-arraybuffer'
import * as Y from 'yjs'
import {Cache} from './Cache'
import {Data} from './Data'
import {Drafts} from './Drafts'
import {Pages} from './Pages'
import {Previews} from './Previews'
import {PreviewStore, previewStore} from './PreviewStore'
import {parentUrl, walkUrl} from './util/Paths'

export type ServerOptions<T extends Workspaces> = {
  config: Config<T>
  createStore: () => Promise<Store>
  drafts: Drafts
  target: Data.Target
  media: Data.Media
  previews: Previews
}

export class Server<T extends Workspaces = Workspaces> implements Hub<T> {
  config: Config<T>
  preview: PreviewStore
  createStore: () => Promise<Store>

  constructor(public options: ServerOptions<T>) {
    this.config = options.config
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
    const {config, drafts, previews} = this.options
    let draft = await drafts.get(id, stateVector)
    if (draft) {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, draft)
      const isValidDraft = outcome.succeeds(() =>
        entryFromDoc(doc, config.type)
      )
      if (!isValidDraft) {
        console.log(`Removed invalid draft ${id}`)
        await drafts.delete([id])
        draft = undefined
      }
    }
    return outcome(async () => {
      const [preview, source] = await Promise.all([
        this.preview.getStore(),
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
          draft: draft && encode(draft),
          previewToken: await previews.sign({id})
        }
      )
    })
  }

  async query<T>(
    cursor: Cursor<T>,
    options?: Hub.QueryOptions
  ): Future<Array<T>> {
    return outcome(async () => {
      const create = options?.source
        ? this.createStore
        : this.preview.getStore.bind(this.preview)
      const store = await create()
      return store.all(cursor)
    })
  }

  listDrafts(workspace: string) {
    return outcome(async () => {
      const store = await this.preview.getStore()
      const drafts = await accumulate(this.drafts.updates())
      const ids = drafts.map(({id}) => id)
      const inWorkspace = store.all(
        Entry.where(Entry.workspace.is(workspace))
          .where(Entry.id.isIn(ids))
          .select(Entry.id)
      )
      return inWorkspace.map(id => ({id}))
    })
  }

  updateDraft(id: string, update: Uint8Array): Future<void> {
    const {drafts} = this.options
    return outcome(async () => {
      const instruction = await drafts.update(id, update)
      await this.preview.applyUpdate(instruction)
    })
  }

  deleteDraft(id: string): Future<boolean> {
    const {drafts} = this.options
    return outcome(async () => {
      await this.preview.deleteUpdate(id)
      const store = await this.preview.getStore()
      drafts.delete([id])
      // Do we still have an entry after removing the draft?
      return Boolean(store.first(Entry.where(Entry.id.is(id))))
    })
  }

  publishEntries(entries: Array<Entry>): Future<void> {
    const {config, drafts, target} = this.options
    function applyPublish(store: Store) {
      Cache.applyPublish(store, config, entries)
      return store
    }
    return outcome(async () => {
      const create = this.createStore
      const current = await create()
      await target.publish(current, entries)
      const ids = entries.map(entry => entry.id)
      await drafts.delete(ids)
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
        url: file.path,
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
      await this.publishEntries([entry])
      return entry
    })
  }

  get drafts() {
    return this.options.drafts
  }

  loadPages<K extends keyof T>(workspaceKey: K, previewToken?: string) {
    const workspace = this.config.workspaces[workspaceKey]
    return new Pages<T[K] extends WorkspaceConfig<infer W> ? W : any>(
      workspace,
      previewToken
        ? async () => {
            await this.parsePreviewToken(previewToken)
            return this.preview.getStore()
          }
        : this.createStore
    )
  }

  async parsePreviewToken(token: string): Promise<{id: string; url: string}> {
    const {previews} = this.options
    const [tokenData, err] = await outcome(() => previews.verify(token))
    if (!tokenData) throw createError(400, `Incorrect token: ${err}`)
    const {id} = tokenData
    const store = await this.preview.getStore()
    await this.preview.fetchUpdate(id)
    const entry = store.first(
      Entry.where(Entry.id.is(id)).select({id: Entry.id, url: Entry.url})
    )
    if (!entry) throw createError(404, 'Entry not found')
    return entry
  }
}
