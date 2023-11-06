import {Store} from 'alinea/backend/Store'
import {CMS, CMSApi} from '../CMS.js'
import {Config} from '../Config.js'
import {Resolver} from '../Resolver.js'

export class DefaultDriver extends CMS {
  exportStore(outDir: string, data: Uint8Array): Promise<void> {
    throw new Error('Not implemented')
  }

  async readStore(): Promise<Store> {
    throw new Error('Not implemented')
  }

  async connection(): Promise<Resolver> {
    throw new Error('Not implemented')
  }
}

export function createCMS<Definition extends Config>(
  config: Definition
): Definition & CMSApi {
  return new DefaultDriver(config) as any
}
