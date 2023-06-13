import sqlite from '@alinea/sqlite-wasm'
import {Database, JWTPreviews, Server} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {Connection} from 'alinea/core'
import {connect} from 'rado/driver/sql.js'
import {CMSApi, DefaultCMS} from '../CMS.js'
import {Config} from '../Config.js'
import {Logger} from '../util/Logger.js'

export interface TestApi extends CMSApi {
  generate(): Promise<void>
}

class TestDriver extends DefaultCMS implements TestApi {
  store: Promise<Store> = sqlite().then(({Database}) =>
    connect(new Database()).toAsync()
  )

  createDevStore(): Promise<Store> {
    return this.store
  }

  async connect(): Promise<Connection> {
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

  async generate() {
    const db = new Database(await this.store, this)
    await db.fill({
      async *entries() {}
    })
  }
}

export function createTestCMS<Definition extends Config>(
  config: Definition
): Definition & TestApi {
  return new TestDriver(config) as any
}
