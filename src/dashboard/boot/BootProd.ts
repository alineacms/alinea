import type {CMS} from '#/core/CMS.js'
import {Client} from '#/core/Client.js'
import {AuthResultType} from '#/cloud/AuthResult.js'
import {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import type {ComponentType} from 'react'
import {boot} from './Boot.js'

export function bootProd(
  handlerUrl: string,
  cms: CMS,
  views: Record<string, ComponentType>,
  cacheKey?: string,
  preloadedUser?: User
) {
  async function* getConfig() {
    const client = new Client({config: cms.config, url: handlerUrl})
    let user = preloadedUser
    if (!user) {
      const auth = await client.authStatus()
      if (auth.type !== AuthResultType.Authenticated)
        throw new Error('Dashboard authentication is required')
      user = auth.user
    }
    const state = await client.contentState()
    if (!state) throw new Error('Content state was not available')
    yield {
      local: false,
      revision: process.env.ALINEA_BUILD_ID as string,
      configId: state.configId,
      cacheKey: cacheKey ?? `${state.configId}-${user.sub}`,
      user,
      policy: Policy.import(state.policy),
      config: cms.config,
      views,
      client
    }
  }
  return boot(getConfig())
}
