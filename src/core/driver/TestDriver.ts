import sqlite from '@alinea/sqlite-wasm'
import {Database, JWTPreviews, Media, Server, Target} from 'alinea/backend'
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
  server = this.store.then(async store => {
    const server = new Server(
      {
        config: this,
        store: store,
        get target(): Target {
          throw new Error('Test driver cannot publish')
        },
        get media(): Media {
          throw new Error('Test driver has no media backend')
        },
        previews: new JWTPreviews('test')
      },
      {
        logger: new Logger('test')
      }
    )
    await server.db.fill({async *entries() {}})
    return server
  })

  async readStore(): Promise<Store> {
    return this.store
  }

  async connection(): Promise<Connection> {
    return this.server
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
