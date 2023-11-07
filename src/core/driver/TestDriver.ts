import sqlite from '@alinea/sqlite-wasm'
import {Database, Handler, JWTPreviews, Media, Target} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {Connection} from 'alinea/core'
import {DefaultDriver} from 'alinea/core/driver/DefaultDriver'
import {connect} from 'rado/driver/sql.js'
import {CMSApi} from '../CMS.js'
import {Config} from '../Config.js'
import {Logger} from '../util/Logger.js'

export interface TestApi extends CMSApi {
  generate(): Promise<void>
}

class TestDriver extends DefaultDriver implements TestApi {
  store: Promise<Store> = sqlite().then(({Database}) =>
    connect(new Database()).toAsync()
  )
  handler = this.store.then(async store => {
    const db = new Database(this, store)
    await db.fill({async *entries() {}})
    const server = new Handler({
      config: this,
      store: store,
      get target(): Target {
        throw new Error('Test driver cannot publish')
      },
      get media(): Media {
        throw new Error('Test driver has no media backend')
      },
      previews: new JWTPreviews('test')
    })
    return server.connect({logger: new Logger('test')})
  })

  async readStore(): Promise<Store> {
    return this.store
  }

  async connection(): Promise<Connection> {
    return this.handler
  }

  async generate() {
    const db = new Database(this, await this.store)
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
