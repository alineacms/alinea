import {Database} from 'alinea/backend'
import {Store, createStore} from 'alinea/backend/Store'
import {EntryResolver} from 'alinea/backend/resolver/EntryResolver'
import {exportStore} from 'alinea/cli/util/ExportStore'
import {base64} from 'alinea/core/util/Encoding'
import PLazy from 'p-lazy'
import {CMS, CMSApi} from '../CMS.js'
import {Client} from '../Client.js'
import {Config} from '../Config.js'
import {Resolver} from '../Resolver.js'
import {Realm} from '../pages/Realm.js'
import {join} from '../util/Paths.js'

export class DefaultDriver extends CMS {
  db = PLazy.from(this.createDb.bind(this))

  exportStore(outDir: string, data: Uint8Array): Promise<void> {
    return exportStore(data, join(outDir, 'store.js'))
  }

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
): Definition & CMSApi {
  return new DefaultDriver(config) as any
}
