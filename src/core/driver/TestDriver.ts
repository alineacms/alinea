import sqlite from '@alinea/sqlite-wasm'
import {Database, Handler, JWTPreviews} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {connect} from 'rado/driver/sql.js'
import {CMS, CMSApi} from '../CMS.js'
import {Config} from '../Config.js'
import {Connection} from '../Connection.js'
import {Resolver} from '../Resolver.js'
import {Logger} from '../util/Logger.js'
import {DefaultDriver} from './DefaultDriver.js'

export interface TestApi extends CMSApi {
  db: Promise<Database>
  connection(): Promise<Connection>
}

class TestDriver extends DefaultDriver implements TestApi {
  store: Promise<Store> = sqlite().then(({Database}) =>
    connect(new Database()).toAsync()
  )
  db = this.store.then(async store => {
    return new Database(this, store)
  })
  handler = this.db.then(async db => {
    await db.fill({async *entries() {}}, '')
    const handler = new Handler({
      config: this,
      db,
      previews: new JWTPreviews('test')
    })
    return handler.connect({logger: new Logger('test')})
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
}

export function createTestCMS<Definition extends Config>(
  config: Definition
): Definition & TestApi & CMS {
  return new TestDriver(config) as any
}
