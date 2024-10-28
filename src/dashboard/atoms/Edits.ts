import {DOC_KEY} from 'alinea/core/Doc'
import {Type} from 'alinea/core/Type'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import * as Y from 'yjs'
import {yAtom} from './YAtom.js'

interface EntryEditsKeys {
  id: string
  locale: string | null
}

export class Edits {
  /** The mutable doc that we are editing */
  doc = new Y.Doc()
  /** The state vector of the source doc */
  sourceVector: Uint8Array | undefined
  sourceUpdate: Uint8Array | undefined
  /** The root map containing field data */
  root = this.doc.getMap(DOC_KEY)
  /** Did we make any local changes? */
  hasChanges = createChangesAtom(this.root)
  /** Clear local changes, reset to source */
  resetChanges = atom(null, (get, set) => {
    set(this.hasChanges, false)
    const copy = new Edits(this.keys)
    if (this.sourceUpdate) copy.applyRemoteUpdate(this.sourceUpdate)
    set(entryEditsAtoms(this.keys), copy)
  })
  /** Whether we have a draft loaded */
  isLoading = yAtom(this.root, () => {
    return !this.hasData()
  })
  yUpdate = yAtom(this.root, () => {
    return this.getLocalUpdate()
  })

  constructor(private keys: EntryEditsKeys) {}

  hasData() {
    return !this.root.keys().next().done
  }

  /** Apply updates from the source */
  applyRemoteUpdate(update: Uint8Array) {
    this.sourceUpdate = update
    this.applyLocalUpdate(update)
    this.sourceVector = Y.encodeStateVectorFromUpdateV2(update)
  }

  /** Apply local updates */
  applyLocalUpdate(update: Uint8Array) {
    Y.applyUpdateV2(this.doc, update, 'self')
  }

  /** A Y.js update that contains our own edits */
  getLocalUpdate() {
    return Y.encodeStateAsUpdateV2(this.doc, this.sourceVector)
  }

  /** The source doc */
  getRemoteUpdate() {
    return Y.encodeStateAsUpdateV2(this.doc)
  }

  /** Update entry field data */
  applyEntryData(type: Type, entryData: Record<string, any>) {
    const clientID = this.doc.clientID
    this.doc.clientID = 1
    this.doc.transact(() => {
      Type.shape(type).applyY(entryData, this.doc, DOC_KEY)
    }, 'self')
    this.doc.clientID = clientID
  }

  /** The field data */
  getEntryData(type: Type): Record<string, any> {
    return Type.shape(type).fromY(this.root)
  }
}

function createChangesAtom(yMap: Y.Map<unknown>) {
  const hasChanges = atom(false)
  hasChanges.onMount = (setAtom: (value: boolean) => void) => {
    const listener = (events: Array<Y.YEvent<any>>, tx: Y.Transaction) => {
      if (tx.origin === 'self') return
      setAtom(true)
    }
    yMap.observeDeep(listener)
    return () => yMap.unobserveDeep(listener)
  }
  return hasChanges
}

export const entryEditsAtoms = atomFamily(
  (keys: EntryEditsKeys) => {
    return atom(new Edits(keys))
  },
  (a, b) => a.id === b.id && a.locale === b.locale
)
