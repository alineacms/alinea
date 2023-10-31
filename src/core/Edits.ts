import {InputState} from 'alinea/editor'
import * as Y from 'yjs'
import {ROOT_KEY} from './Doc.js'
import {Type} from './Type.js'

export class Edits {
  /* The mutable doc that we are editing */
  doc = new Y.Doc(/*{gc: false}*/)
  /* The state vector of the source doc */
  sourceVector: Uint8Array = Y.encodeStateVector(this.doc)
  /* The root map containing field data */
  root = this.doc.getMap(ROOT_KEY)
  /* The state passed to the input form */
  state: InputState.YDocState<any, any>

  constructor(public type: Type) {
    this.state = new InputState.YDocState(Type.shape(type), this.root, '')
  }

  /* Apply updates from the source */
  applyUpdate(update: Uint8Array, stateVector: Uint8Array) {
    Y.applyUpdateV2(this.doc, update)
    this.sourceVector = stateVector
  }

  /* A Y.js update that contains our own edits */
  getUpdate() {
    return Y.encodeStateAsUpdate(this.doc, this.sourceVector)
  }

  /* Update entry field */
  applyEntryData(entry: Record<string, any>) {
    this.doc.transact(() => {
      Type.shape(this.type).applyY(entry, this.doc, ROOT_KEY)
    })
  }

  /* The field data */
  getEntryData(): Record<string, any> {
    return Type.shape(this.type).fromY(this.root)
  }
}
