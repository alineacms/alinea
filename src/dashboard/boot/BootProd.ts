import type {CMS} from '#/core/CMS.js'
import {Client} from '#/core/Client.js'
import type {ComponentType} from 'react'
import {boot} from './Boot.js'

/**
 * Boot a built dashboard. Its build id is a hash of the built files, which
 * the page passes in the script URL, so that a deploy that leaves the
 * dashboard unchanged keeps its shared worker and the tabs it serves.
 */
export function bootProd(
  handlerUrl: string,
  cms: CMS,
  views: Record<string, ComponentType>,
  buildId: string = process.env.ALINEA_BUILD_ID as string
) {
  async function* getConfig() {
    yield {
      local: false,
      revision: buildId,
      configFingerprint: process.env.ALINEA_CONFIG_FINGERPRINT as string,
      config: cms.config,
      views,
      client: new Client({config: cms.config, url: handlerUrl})
    }
  }
  return boot(getConfig())
}
