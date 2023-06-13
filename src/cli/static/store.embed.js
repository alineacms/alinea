import init from '@alinea/sqlite-wasm'
import {base64} from 'alinea/core/util/Encoding'
import {connect} from 'alinea/vendor/rado/driver/sql.js'

const buffer = base64.parse('$DB')

export function createStore() {
  return init().then(({Database}) => {
    return connect(new Database(new Uint8Array(buffer))).toAsync()
  })
}
