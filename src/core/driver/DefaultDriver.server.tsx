import {Server} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {exportStore} from 'alinea/cli/util/ExportStore'
import {CMS, CMSApi} from '../CMS.js'
import {Config} from '../Config.js'
import {Connection} from '../Connection.js'
import {Logger} from '../util/Logger.js'
import {join} from '../util/Paths.js'

export class DefaultDriver extends CMS {
  exportStore(outDir: string, data: Uint8Array): Promise<void> {
    return exportStore(data, join(outDir, 'store.js'))
  }

  async readStore(): Promise<Store> {
    // @ts-ignore
    const {createStore} = await import('@alinea/generated/store.js')
    return createStore()
  }

  async connection(): Promise<Connection> {
    const store = await this.readStore()
    return new Server(
      {
        config: this.config,
        store,
        media: undefined!,
        target: undefined!,
        previews: undefined!
      },
      {logger: new Logger('CMSDriver')}
    )
  }
}

export function createCMS<Definition extends Config>(
  config: Definition
): Definition & CMSApi {
  return new DefaultDriver(config) as any
}
