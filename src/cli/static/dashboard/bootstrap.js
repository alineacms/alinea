import {AuthResultType} from 'alinea/cloud/AuthResult'

const params = new URL(import.meta.url).searchParams
const handlerUrl = params.get('handlerUrl')

function handler(params) {
  const url = new URL(handlerUrl, window.location.href)
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value)
  return url
}

function appendFrom(url) {
  const from = encodeURIComponent(window.location.href)
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}from=${from}`
}

function showError(message) {
  const element = document.createElement('pre')
  element.textContent = message
  document.body.replaceChildren(element)
}

async function requestJson(url) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {accept: 'application/json'}
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

async function bootstrap() {
  if (!handlerUrl) throw new Error('Missing Alinea handler URL')
  const auth = await requestJson(handler({auth: 'status'}))
  switch (auth.type) {
    case AuthResultType.Authenticated:
      break
    case AuthResultType.UnAuthenticated:
      window.location.href = appendFrom(auth.redirect)
      return
    case AuthResultType.MissingApiKey:
      window.location.href = appendFrom(auth.setupUrl)
      return
    case AuthResultType.NeedsRefresh:
      window.location.reload()
      return
    default:
      throw new Error('Unknown Alinea authentication response')
  }
  const release = await requestJson(handler({action: 'bootstrap'}))
  const stylesheet = document.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = release.styleUrl
  document.head.append(stylesheet)
  const moduleUrl = new URL(release.moduleUrl, window.location.href)
  moduleUrl.searchParams.set('handlerUrl', handlerUrl)
  moduleUrl.searchParams.set('cacheKey', release.cacheKey)
  const dashboard = await import(moduleUrl.href)
  await dashboard.startDashboard(handlerUrl, release.cacheKey, auth.user)
}

bootstrap().catch(error => {
  console.error(error)
  showError(error instanceof Error ? error.message : String(error))
})
