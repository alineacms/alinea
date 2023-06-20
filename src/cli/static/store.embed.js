import {createStore as CS} from 'alinea/backend/Store'
import {base64} from 'alinea/core/util/Encoding'

const buffer = base64.parse('$DB')

export function createStore() {
  return CS(new Uint8Array(buffer))
}
