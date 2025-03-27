import {CMS} from 'alinea/core/CMS'
import {Client} from 'alinea/core/Client'
import type {Config} from 'alinea/core/Config'
import {MemorySource} from 'alinea/core/source/MemorySource'
import {previewContext} from './previewContext.js'

export class VanillaCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  async getContext() {
    return previewContext(this)
  }
}

export function createCMS<Definition extends Config>(config: Definition) {
  const devUrl = process.env.ALINEA_DEV_SERVER
  const cms: VanillaCMS<Definition> = new VanillaCMS(
    config,
    new MemorySource(),
    async () => new Client({config: cms.config, url: devUrl ?? '/api/cms'})
  )
  return cms
}
