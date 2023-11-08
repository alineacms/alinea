import sqlite from '@alinea/sqlite-wasm'
import {Database, Handler, JWTPreviews, Media, Target} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {connect} from 'rado/driver/sql.js'
import {CMSApi} from '../CMS.js'
import {Config} from '../Config.js'
import {Connection} from '../Connection.js'
import {Resolver} from '../Resolver.js'
import {Logger} from '../util/Logger.js'
import {DefaultDriver} from './DefaultDriver.js'

export interface TestApi extends CMSApi {
  connection(): Promise<Connection>
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
      db,
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

  async resolver(): Promise<Resolver> {
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
