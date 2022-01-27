import {createError, docFromEntry, EntryStatus} from '@alinea/core'
import {Hub} from '@alinea/core/Hub'
import {EntryDraft} from '@alinea/editor/EntryDraft'
import {observable} from '@alinea/ui'
import {createContext, PropsWithChildren, useContext, useMemo} from 'react'
import {Room, WebrtcProvider} from 'y-webrtc'
import * as Y from 'yjs'
import {useSession} from './UseSession'

type DraftsStatus = 'synced' | 'editing' | 'saving'

class Drafts {
  saveTimeout: ReturnType<typeof setTimeout> | null = null
  status = observable<DraftsStatus>('synced')
  stateVectors = new Map()

  constructor(public hub: Hub) {}

  async save(id: string, doc: Y.Doc) {
    const {hub} = this
    const sv = Y.encodeStateVector(doc)
    const update = Y.encodeStateAsUpdate(doc, this.stateVectors.get(id)!)
    await hub.updateDraft(id, update).then(() => {
      this.stateVectors.set(id, sv)
    })
  }

  async get(id: string) {
    const {hub} = this
    const doc = new Y.Doc()
    const [result, error] = await hub.entry(id)
    if (error) throw error
    if (!result) throw createError(404, `Entry not found`)
    const type = hub.schema.type(result.entry.type)
    if (!type) throw createError(404, `Type not found`)
    docFromEntry(type, result.entry, doc)
    this.stateVectors.set(id, Y.encodeStateVector(doc))
    return {...result, type, doc}
  }

  async publish(draft: EntryDraft) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    draft.status(EntryStatus.Publishing)
    this.status('saving')
    return this.hub.publishEntries([draft.getEntry()]).then(res => {
      if (res.isFailure()) console.error(res.error)
      draft.status(res.isSuccess() ? EntryStatus.Published : EntryStatus.Draft)
      this.status('synced')
    })
  }

  connect(id: string, doc: Y.Doc) {
    const provider = new WebrtcProvider('@alinea/entry-' + id, doc)
    const save = async () => {
      this.saveTimeout = null
      this.status('saving')
      await this.save(id, doc)
      if (this.saveTimeout === null) this.status('synced')
    }
    const watch = (
      update?: Uint8Array,
      origin?: Room | undefined,
      doc?: Y.Doc,
      transaction?: Y.Transaction
    ) => {
      // This update did not originate from us
      if (origin instanceof Room) return
      this.status('editing')
      if (this.saveTimeout) clearTimeout(this.saveTimeout)
      this.saveTimeout = setTimeout(save, 3000)
    }
    doc.on('update', watch)
    return () => {
      doc.off('update', watch)
      provider.destroy()
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout)
        save()
      }
    }
  }
}

const context = createContext<Drafts | undefined>(undefined)

export function DraftsProvider({children}: PropsWithChildren<{}>) {
  const {hub} = useSession()
  const instance = useMemo(() => new Drafts(hub), [hub])
  return <context.Provider value={instance}>{children}</context.Provider>
}

export function useDrafts() {
  return useContext(context)!
}
