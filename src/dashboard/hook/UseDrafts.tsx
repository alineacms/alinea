import {
  Config,
  Connection,
  createError,
  docFromEntry,
  EntryMeta,
  EntryPhase,
  Outcome,
  ROOT_KEY
} from 'alinea/core'
import {base64} from 'alinea/core/util/Encoding'
import {observable} from 'alinea/ui'
import {createContext, PropsWithChildren, useContext, useMemo} from 'react'
import {QueryClient, useQueryClient} from 'react-query'
// import {Room} from 'y-webrtc'
import * as Y from 'yjs'
import {EntryDraft} from '../draft/EntryDraft.js'
import {useDashboard} from './UseDashboard.js'
import {useSession} from './UseSession.js'

export enum DraftsStatus {
  Synced = 'synced',
  Editing = 'editing',
  Saving = 'saving'
}

type Move = {
  id: string
  parent: string | undefined
  index: string
}

class Drafts {
  saveDelay = 500
  saveTimeout: ReturnType<typeof setTimeout> | null = null
  status = observable<DraftsStatus>(DraftsStatus.Synced)
  stateVectors = new WeakMap<Y.Doc, Uint8Array>()

  constructor(
    public config: Config,
    public cnx: Connection,
    protected queryClient: QueryClient
  ) {}

  async save(id: string, doc: Y.Doc) {
    const {cnx} = this
    const sv = Y.encodeStateVector(doc)
    const update = Y.encodeStateAsUpdate(doc) // , this.stateVectors.get(doc))
    await cnx
      .updateDraft({id, update})
      .then(Outcome.unpack)
      .then(() => {
        this.stateVectors.set(doc, sv)
      })
  }

  async get(id: string) {
    const {cnx: hub, config} = this
    const doc = new Y.Doc()
    const [result, error] = await hub.entry({id})
    if (error) throw error
    if (!result) throw createError(404, `Entry not found`)
    const type = config.schema[result.entry.type]
    if (!type) throw createError(404, `Type not found`)
    if (result.draft) {
      Y.applyUpdate(doc, base64.parse(result.draft))
      this.stateVectors.set(doc, Y.encodeStateVector(doc))
    } else {
      docFromEntry(result.entry, () => type, doc)
    }
    return {...result, type, doc}
  }

  async list(workspace: string) {
    return this.cnx.listDrafts({workspace}).then(Outcome.unpack)
  }

  async discard(draft: EntryDraft) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    draft.phase(EntryPhase.Publishing)
    this.status(DraftsStatus.Saving)
    return this.cnx.deleteDraft({id: draft.versionId}).then(result => {
      draft.phase(EntryPhase.Published)
      this.queryClient.invalidateQueries('draft-list')
      return result
    })
  }

  async publish(draft: EntryDraft) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    draft.phase(EntryPhase.Publishing)
    this.status(DraftsStatus.Saving)
    return this.cnx.createEntries({entries: [draft.getEntry()]}).then(res => {
      if (res.isFailure()) console.error(res.error)
      draft.phase(res.isSuccess() ? EntryPhase.Published : EntryPhase.Draft)
      this.status(DraftsStatus.Synced)
      this.queryClient.invalidateQueries('draft-list')
    })
  }

  async move(move: Move) {
    const draft = await this.get(move.id)
    const meta = draft.doc.getMap(ROOT_KEY).get('alinea') as EntryMeta
    draft.doc
      .getMap(ROOT_KEY)
      .set('alinea', {...meta, index: move.index, parent: move.parent})
    await this.save(move.id, draft.doc)
  }

  connect(id: string, doc: Y.Doc) {
    // alineacms/alinea#51
    // const provider = new WebrtcProvider('@alinea/entry-' + id, doc)
    const save = async () => {
      this.saveTimeout = null
      this.status(DraftsStatus.Saving)
      await this.save(id, doc)
      if (this.saveTimeout === null) this.status(DraftsStatus.Synced)
      // Todo: this is only necessary if it is not already in the draft list
      this.queryClient.invalidateQueries('draft-list')
    }
    const watch = (
      update?: Uint8Array,
      origin?: undefined, // Room | undefined,
      doc?: Y.Doc,
      transaction?: Y.Transaction
    ) => {
      // This update did not originate from us
      // if (origin instanceof Room) return
      this.status(DraftsStatus.Editing)
      if (this.saveTimeout) clearTimeout(this.saveTimeout)
      this.saveTimeout = setTimeout(save, this.saveDelay)
    }
    doc.on('update', watch)
    return () => {
      doc.off('update', watch)
      // provider.destroy()
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout)
        save()
      }
    }
  }
}

const context = createContext<Drafts | undefined>(undefined)

export function DraftsProvider({children}: PropsWithChildren<{}>) {
  const queryClient = useQueryClient()
  const {config} = useDashboard()
  const {cnx: hub} = useSession()
  const instance = useMemo(
    () => new Drafts(config, hub, queryClient),
    [config, hub]
  )
  return <context.Provider value={instance}>{children}</context.Provider>
}

export function useDrafts() {
  return useContext(context)!
}
