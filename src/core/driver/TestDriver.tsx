import sqlite from '@alinea/sqlite-wasm'
import {JWTPreviews, Server} from 'alinea/backend'
import {Connection} from 'alinea/core'
import {connect} from 'rado/driver/sql.js'
import {CMSApi, DefaultCMS} from '../CMS.js'
import {Config} from '../Config.js'
import {Logger} from '../util/Logger.js'

class TestDriver extends DefaultCMS {
  store = sqlite().then(({Database}) => connect(new Database()).toAsync())

  createStore() {
    return this.store
  }

  async connection(): Promise<Connection> {
    const isBrowser = typeof window !== 'undefined'
    if (isBrowser)
      throw new Error('Test drivers are not available in the browser')
    return new Server(
      {
        config: this,
        store: await this.store,
        target: undefined!,
        media: undefined!,
        previews: new JWTPreviews('test')
      },
      {
        logger: new Logger('test')
      }
    )
  }
}

export function createTestCMS<Definition extends Config>(
  config: Definition
): Definition & CMSApi {
  return new TestDriver(config) as any
}
