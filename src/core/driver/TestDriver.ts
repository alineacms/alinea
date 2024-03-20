import sqlite from '@alinea/sqlite-wasm'
import {Database, Handler, JWTPreviews} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import type {AddressInfo} from 'node:net'
import {connect} from 'rado/driver/sql.js'
import {CMS} from '../CMS.js'
import {Config} from '../Config.js'
import {Connection} from '../Connection.js'
import {createId} from '../Id.js'
import {Resolver} from '../Resolver.js'
import {Logger} from '../util/Logger.js'

export interface TestApi extends CMS {
  db: Promise<Database>
  handler: Promise<Handler>
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
    return new Handler({
      config: this.config,
      db,
      previews: new JWTPreviews('test'),
      previewAuthToken: 'test',
      target: {
        mutate: async ({mutations}) => {
          return {commitHash: createId()}
        }
      },
      media: {
        async prepareUpload(file: string) {
          const id = createId()
          const serve = await listenForUpload()
          return {
            entryId: createId(),
            location: `media/${file}_${id}`,
            previewUrl: `media/${file}_${id}`,
            upload: {
              url: serve.url
            }
          }
        }
      }
    })
  })
  cnx = this.handler.then(handler =>
    handler.connect({logger: new Logger('test')})
  )
  connection = (): Promise<Connection> => this.cnx
  resolver = (): Promise<Resolver> => this.cnx
}

export function createTestCMS<Definition extends Config>(
  config: Definition
): Definition & TestApi & CMS {
  return new TestDriver(config) as any
}

async function listenForUpload(): Promise<{url: string}> {
  const {createServer} = await import('http')
  const server = createServer((req, res) => {
    res.end()
    server.close()
  })
  return new Promise(resolve => {
    server.listen(0, () => {
      resolve({
        url: `http://localhost:${(server.address() as AddressInfo).port}`
      })
    })
  })
}
