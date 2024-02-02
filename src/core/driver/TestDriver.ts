import sqlite from '@alinea/sqlite-wasm'
import {Database, Handler, JWTPreviews} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {connect} from 'rado/driver/sql.js'
import {CMS} from '../CMS.js'
import {Config} from '../Config.js'
import {Connection} from '../Connection.js'
import {createId} from '../Id.js'
import {Resolver} from '../Resolver.js'
import {Logger} from '../util/Logger.js'

export interface TestApi extends CMS {
  db: Promise<Database>
  connection(): Promise<Connection>
}

class TestDriver extends CMS implements TestApi {
  store: Promise<Store> = sqlite().then(({Database}) =>
    connect(new Database()).toAsync()
  )
  db = this.store.then(async store => {
    const db = new Database(this.config, store)
    await db.fill({async *entries() {}}, '')
    return db
  })
  handler = this.db.then(async db => {
    const handler = new Handler({
      config: this.config,
      db,
      previews: new JWTPreviews('test'),
      previewAuthToken: 'test',
      target: {
        mutate: async ({mutations}) => {
          return {commitHash: createId()}
        }
      }
    })
    return handler.connect({logger: new Logger('test')})
  })

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
