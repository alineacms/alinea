import type {CMS} from 'alinea/core/CMS.js'
import {Client} from 'alinea/core/Client'
import type {ComponentType} from 'react'
import {boot} from './Boot.js'

export function bootProd(
  handlerUrl: string,
  cms: CMS,
  views: Record<string, ComponentType>
) {
  async function* getConfig() {
    yield {
      dev: false,
      revision: process.env.ALINEA_BUILD_ID as string,
      config: cms.config,
      views,
      client: new Client({config: cms.config, url: handlerUrl})
    }
  }
  return boot(getConfig())
}
