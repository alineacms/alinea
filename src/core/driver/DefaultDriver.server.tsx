import {Database} from 'alinea/backend'
import {createStore} from 'alinea/backend/Store'
import {EntryResolver} from 'alinea/backend/resolver/EntryResolver'
import {createCloudHandler} from 'alinea/cloud/server/CloudHandler'
import {base64} from 'alinea/core/util/Encoding'
import PLazy from 'p-lazy'
import {CMS} from '../CMS.js'
import {Client} from '../Client.js'
import {Config} from '../Config.js'
import {Connection} from '../Connection.js'
import {Resolver} from '../Resolver.js'
import {Realm} from '../pages/Realm.js'
import {Logger} from '../util/Logger.js'

const store = PLazy.from(async () => {
  // @ts-ignore
  const {storeData} = import('@alinea/generated/store.js')
  return createStore(new Uint8Array(base64.parse(storeData)))
})

export class DefaultDriver extends CMS {
  apiKey = process.env.ALINEA_API_KEY
  db = PLazy.from(async () => new Database(this.config, await store))
  cloudHandler = PLazy.from(async () => {
    const db = await this.db
    return createCloudHandler(this.config, db, this.apiKey)
  })

  async resolver(): Promise<Resolver> {
    const devUrl = process.env.ALINEA_DEV_SERVER
    if (devUrl)
      return new Client({
        config: this.config,
        url: devUrl,
        resolveDefaults: {
          syncInterval: this.config.syncInterval ?? 60,
          realm: Realm.Published
        }
      })
    return new EntryResolver(await this.db, this.config.schema)
  }

  async connection(): Promise<Connection> {
    const devUrl = process.env.ALINEA_DEV_SERVER
    if (devUrl) return new Client({config: this.config, url: devUrl})
    return (await this.cloudHandler).connect({
      logger: new Logger('driver')
    })
  }
}

export function createCMS<Definition extends Config>(
  config: Definition
): Definition & CMS {
  return new DefaultDriver(config) as any
}
