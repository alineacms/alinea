import {createError, docFromEntry} from '@alinea/core'
import {Hub} from '@alinea/core/Hub'
import {observable} from '@alinea/ui'
import {createContext, PropsWithChildren, useContext, useMemo} from 'react'
import {Room, WebrtcProvider} from 'y-webrtc'
import * as Y from 'yjs'
import {useSession} from './UseSession'

type DraftsStatus = 'synced' | 'editing' | 'saving'

class Drafts {
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

  connect(id: string, doc: Y.Doc) {
    let saveTimeout: ReturnType<typeof setTimeout> | null = null
    const provider = new WebrtcProvider('@alinea/entry-' + id, doc)
    const save = async () => {
      saveTimeout = null
      this.status('saving')
      await this.save(id, doc)
      if (saveTimeout === null) this.status('synced')
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
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(save, 3000)
    }
    doc.on('update', watch)
    return () => {
      doc.off('update', watch)
      provider.destroy()
      if (saveTimeout) {
        clearTimeout(saveTimeout)
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
