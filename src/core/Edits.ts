import * as Y from 'yjs'
import {ROOT_KEY} from './Doc.js'
import {Type} from './Type.js'

export class Edits {
  /* The mutable doc that we are editing */
  doc = new Y.Doc(/*{gc: false}*/)
  /* The state vector of the source doc */
  sourceVector: Uint8Array | undefined
  /* The root map containing field data */
  root = this.doc.getMap(ROOT_KEY)

  constructor(public type: Type) {}

  /** Apply updates from the source */
  applyRemoteUpdate(update: Uint8Array) {
    this.applyLocalUpdate(update)
    this.sourceVector = Y.encodeStateVectorFromUpdateV2(update)
  }

  /** Apply local updates */
  applyLocalUpdate(update: Uint8Array) {
    Y.applyUpdateV2(this.doc, update)
  }

  /** A Y.js update that contains our own edits, base64 encoded */
  getLocalUpdate() {
    return Y.encodeStateAsUpdateV2(this.doc, this.sourceVector)
  }

  /** The source doc */
  getRemoteUpdate() {
    return Y.encodeStateAsUpdateV2(this.doc)
  }

  /** Update entry field data */
  applyEntryData(entryData: Record<string, any>) {
    const clientID = this.doc.clientID
    this.doc.clientID = 1
    this.doc.transact(() => {
      Type.shape(this.type).applyY(entryData, this.doc, ROOT_KEY)
    })
    this.doc.clientID = clientID
  }

  /** The field data */
  getEntryData(): Record<string, any> {
    return Type.shape(this.type).fromY(this.root)
  }
}
