import {Client} from 'alinea/core/Client'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
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
    async () => new Client({url: devUrl ?? '/api/cms'})
  )
  return cms
}
