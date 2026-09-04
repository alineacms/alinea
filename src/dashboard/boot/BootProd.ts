import type {CMS} from '#/core/CMS.js'
import {Client} from '#/core/Client.js'
import type {ComponentType} from 'react'
import {AuthResultType, type AuthResult} from '#/cloud/AuthResult.js'
import {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {HttpReplicaTransport} from '#/database/replica/HttpTransport.js'
import {boot} from './Boot.js'

export function bootProd(
  handlerUrl: string,
  bundledCms?: CMS,
  bundledViews?: Record<string, ComponentType>
) {
  async function* getConfig() {
    const authenticatedUser = await ensureAuthenticated(handlerUrl)
    const bootstrap = await new HttpReplicaTransport({handlerUrl}).bootstrap()
    const {cms, views} =
      bundledCms && bundledViews
        ? {cms: bundledCms, views: bundledViews}
        : await loadAuthenticatedConfig(bootstrap.configUrl)
    yield {
      local: false,
      // A named SharedWorker can outlive a tab and an authentication session.
      // Include the authenticated view so a new session cannot reuse its DB.
      revision: `${process.env.ALINEA_BUILD_ID}:${bootstrap.user.id}:${bootstrap.viewId}`,
      config: cms.config,
      views,
      handlerUrl,
      authenticated: {
        user: authenticatedUser,
        policy: Policy.fromData(bootstrap.policy)
      },
      client: new Client({config: cms.config, url: handlerUrl})
    }
  }
  return boot(getConfig())
}

interface ClientConfigModule {
  cms: CMS
  views: Record<string, ComponentType>
}

async function loadAuthenticatedConfig(
  configUrl: string
): Promise<ClientConfigModule> {
  const loaded = (await import(
    /* @vite-ignore */ configUrl
  )) as ClientConfigModule
  if (!loaded.cms || !loaded.views)
    throw new Error(`Invalid client config at "${configUrl}"`)
  return loaded
}

async function ensureAuthenticated(handlerUrl: string): Promise<User> {
  const url = new URL(handlerUrl, globalThis.location.href)
  url.searchParams.set('auth', 'status')
  const response = await fetch(url, {
    credentials: 'include',
    headers: {accept: 'application/json'}
  })
  if (!response.ok) throw new Error('Alinea handler is unavailable')
  const result = (await response.json()) as AuthResult
  switch (result.type) {
    case AuthResultType.Authenticated:
      return result.user
    case AuthResultType.UnAuthenticated:
      globalThis.location.href = appendFrom(result.redirect)
      return new Promise(() => {})
    case AuthResultType.MissingApiKey:
      globalThis.location.href = appendFrom(result.setupUrl)
      return new Promise(() => {})
    case AuthResultType.NeedsRefresh:
      globalThis.location.reload()
      return new Promise(() => {})
  }
}

function appendFrom(url: string): string {
  const from = encodeURIComponent(globalThis.location.href)
  return `${url}${url.includes('?') ? '&' : '?'}from=${from}`
}
