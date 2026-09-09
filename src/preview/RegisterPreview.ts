import type {PreviewMetadata, PreviewPayload} from '#/core/Preview.js'
import {PreviewAction, type PreviewMessage} from '#/preview/PreviewMessage.js'

export interface PreviewApi {
  preview(update: PreviewPayload): Promise<void>
  setIsPreviewing(isPreviewing: boolean): void
}

export function registerPreview(api: PreviewApi, hostOrigin: string) {
  if (typeof window === 'undefined') return
  const host: Window | null =
    window.parent !== window ? window.parent : window.opener
  if (!host) return
  let observer: MutationObserver | null = null
  // Closing the CMS can prevent its final disconnect message from arriving.
  const checkHost = window.setInterval(() => {
    if (host.closed) disconnect()
  }, 1000)
  addEventListener('message', handleMessage)
  host.postMessage({action: PreviewAction.Ping}, hostOrigin)
  console.info('[Alinea preview listener attached]')
  return () => {
    clearInterval(checkHost)
    if (observer) observer.disconnect()
    removeEventListener('message', handleMessage)
  }

  function disconnect() {
    clearInterval(checkHost)
    observer?.disconnect()
    observer = null
    api.setIsPreviewing(false)
    removeEventListener('message', handleMessage)
  }

  function handleMessage(event: MessageEvent<PreviewMessage>) {
    if (event.source !== host) return
    if (event.origin !== hostOrigin) return
    if (!event.data || typeof event.data !== 'object') return
    const message = event.data as PreviewMessage
    switch (message.action) {
      case PreviewAction.Disconnect:
        disconnect()
        return
      case PreviewAction.Preview:
        console.info('[Alinea preview received]')
        api.preview(message)
        return
      case PreviewAction.Reload:
        console.info('[Alinea preview reload received]')
        return location.reload()
      case PreviewAction.Previous:
        console.info('[Alinea preview previous received]')
        return history.back()
      case PreviewAction.Next:
        console.info('[Alinea preview next received]')
        return history.forward()
      case PreviewAction.Pong:
        console.info('[Alinea preview pong received]')
        api.setIsPreviewing(true)
        try {
          fetchAndSendMetadata()
          observer?.disconnect()
          observer = new MutationObserver(fetchAndSendMetadata)
          observer.observe(document.head, {childList: true})
          console.info('[Alinea meta data sent to parent]')
        } catch (e) {
          console.error('[Alinea meta data sent to parent failed]')
        }
    }
  }

  function fetchAndSendMetadata() {
    if (!host) return
    const meta = fetchMetadataFromDocument()
    host.postMessage({action: PreviewAction.Meta, ...meta}, hostOrigin)
  }
}
function fetchMetadataFromDocument(): PreviewMetadata {
  return {
    title: document.title,
    description: fetchData('meta[name="description"]'),

    language: fetchData('meta[name="language"]'),
    robots: fetchData('meta[name="robots"]'),
    canonical: fetchData('link[rel="canonical"]', 'href'),

    'og:url': fetchData('meta[property="og:url"]'),
    'og:site_name': fetchData('meta[property="og:site_name"]'),
    'og:title': fetchData('meta[property="og:title"]'),
    'og:description': fetchData('meta[property="og:description"]'),
    'og:image': fetchData('meta[property="og:image"]'),
    'og:image:width': fetchData('meta[property="og:image:width"]'),
    'og:image:height': fetchData('meta[property="og:image:height"]'),

    'twitter:card': fetchData('meta[property="twitter:card"]'),
    'twitter:title': fetchData('meta[property="twitter:title"]'),
    'twitter:image': fetchData('meta[property="twitter:image"]'),
    'twitter:image:width': fetchData('meta[property="twitter:image:width"]'),
    'twitter:image:height': fetchData('meta[property="twitter:image:height"]')
  }
}

function fetchData(
  selector: string,
  attribute = 'content'
): string | undefined {
  return document.querySelector(selector)?.getAttribute(attribute) || undefined
}
