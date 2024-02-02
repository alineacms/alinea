import {Store} from 'alinea/backend/Store'
import {CMS} from '../CMS.js'
import {Config} from '../Config.js'
import {Resolver} from '../Resolver.js'

export class DefaultDriver extends CMS {
  async readStore(): Promise<Store> {
    throw new Error('Not implemented')
  }

  async resolver(): Promise<Resolver> {
    throw new Error('Not implemented')
  }
}

export function createCMS<Definition extends Config>(
  config: Definition
): Definition & CMS {
  return new DefaultDriver(config) as any
}
