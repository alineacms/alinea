import type {Entry} from 'alinea/core'
import {DOC_KEY} from 'alinea/core/Doc'
import {Type} from 'alinea/core/Type'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import * as Y from 'yjs'
import {configAtom} from './DashboardAtoms.js'
import {yAtom} from './YAtom.js'

interface EntryEditsKeys {
  id: string
  locale: string | null
  fileHash: string
}

export class Edits {
  #type: Type
  #entry: Entry
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
    this.applyEntryData(this.#entry.data)
    set(this.hasChanges, false)
  })
  yUpdate = yAtom(this.root, () => {
    return this.getLocalUpdate()
  })

  constructor(type: Type, entry: Entry) {
    this.#type = type
    this.#entry = entry
    this.applyEntryData(entry.data)
    this.sourceVector = Y.encodeStateVector(this.doc)
  }

  hasData() {
    return !this.root.keys().next().done
  }

  /** A Y.js update that contains our own edits */
  getLocalUpdate() {
    return Y.encodeStateAsUpdate(this.doc, this.sourceVector)
  }

  /** Update entry field data */
  applyEntryData(entryData: Record<string, any>) {
    const clientID = this.doc.clientID
    this.doc.clientID = 1
    this.doc.transact(() => {
      Type.shape(this.#type).applyY(entryData, this.doc, DOC_KEY)
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
  (entry: Entry) => {
    return atom(get => {
      const config = get(configAtom)
      const type = config.schema[entry.type]
      return new Edits(type, entry)
    })
  },
  (a, b) =>
    a.id === b.id &&
    a.locale === b.locale &&
    a.fileHash === b.fileHash &&
    // This is a check for untranslated entries, where the path is cleared
    a.data.path === b.data.path
)
