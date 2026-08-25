import type {CMS} from '#/core/CMS.js'
import {Client} from '#/core/Client.js'
import type {ComponentType} from 'react'
import {AuthResultType, type AuthResult} from '#/cloud/AuthResult.js'
import {HttpReplicaTransport} from '#/database/replica/HttpTransport.js'
import {boot} from './Boot.js'

export function bootProd(
  handlerUrl: string,
  bundledCms?: CMS,
  bundledViews?: Record<string, ComponentType>
) {
  async function* getConfig() {
    const {cms, views} =
      bundledCms && bundledViews
        ? {cms: bundledCms, views: bundledViews}
        : await loadAuthenticatedConfig(handlerUrl)
    yield {
      local: false,
      revision: process.env.ALINEA_BUILD_ID as string,
      config: cms.config,
      views,
      handlerUrl,
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
  handlerUrl: string
): Promise<ClientConfigModule> {
  await ensureAuthenticated(handlerUrl)
  const bootstrap = await new HttpReplicaTransport({handlerUrl}).bootstrap()
  const loaded = (await import(
    /* @vite-ignore */ bootstrap.configUrl
  )) as ClientConfigModule
  if (!loaded.cms || !loaded.views)
    throw new Error(`Invalid client config at "${bootstrap.configUrl}"`)
  return loaded
}

async function ensureAuthenticated(handlerUrl: string): Promise<void> {
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
      return
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
