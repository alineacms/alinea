import {Database} from 'alinea/backend'
import {Store, createStore} from 'alinea/backend/Store'
import {EntryResolver} from 'alinea/backend/resolver/EntryResolver'
import {base64} from 'alinea/core/util/Encoding'
import PLazy from 'p-lazy'
import {CMS} from '../CMS.js'
import {Client} from '../Client.js'
import {Config} from '../Config.js'
import {Resolver} from '../Resolver.js'
import {Realm} from '../pages/Realm.js'

export class DefaultDriver extends CMS {
  db = PLazy.from(this.createDb.bind(this))

  async readStore(): Promise<Store> {
    // @ts-ignore
    const {storeData} = await import('@alinea/generated/store.js')
    return createStore(new Uint8Array(base64.parse(storeData)))
  }

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

  private async createDb() {
    return new Database(this.config, await this.readStore())
  }
}

export function createCMS<Definition extends Config>(
  config: Definition
): Definition & CMS {
  return new DefaultDriver(config) as any
}
