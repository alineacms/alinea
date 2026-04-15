import type {CMS} from '#/core/CMS.js'
import {Client} from '#/core/Client.js'
import type {ComponentType} from 'react'
import {boot} from './Boot.js'

export function bootProd(
  handlerUrl: string,
  cms: CMS,
  views: Record<string, ComponentType>
) {
  async function* getConfig() {
    yield {
      local: false,
      revision: process.env.ALINEA_BUILD_ID as string,
      config: cms.config,
      views,
      client: new Client({config: cms.config, url: handlerUrl})
    }
  }
  return boot(getConfig())
}
