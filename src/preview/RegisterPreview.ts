import type {PreviewMetadata, PreviewUpdate} from 'alinea/core/Resolver'
import {PreviewAction, PreviewMessage} from 'alinea/preview/PreviewMessage'

export interface PreviewApi {
  preview(update: PreviewUpdate): Promise<void>
  setIsPreviewing(isPreviewing: boolean): void
}

export function registerPreview(api: PreviewApi) {
  if (typeof window === 'undefined') return
  function handleMessage(event: MessageEvent<PreviewMessage>) {
    if (!event.data || typeof event.data !== 'object') return
    const message = event.data as PreviewMessage
    switch (message.action) {
      case PreviewAction.Preview:
        console.log('[Alinea preview received]')
        api.preview(message)
        return
      case PreviewAction.Reload:
        console.log('[Alinea preview reload received]')
        return location.reload()
      case PreviewAction.Previous:
        console.log('[Alinea preview previous received]')
        return history.back()
      case PreviewAction.Next:
        console.log('[Alinea preview next received]')
        return history.forward()
      case PreviewAction.Ping:
        console.log('[Alinea preview ping received]')
        api.setIsPreviewing(true)
        return window.parent.postMessage(
          {action: PreviewAction.Pong},
          event.origin
        )
    }
  }
  let observer: MutationObserver | null = null
  if (window.location != window.parent.location) {
    // On first load send a pong because we might have missed ping,
    // this can warn in the console but it seems we cannot catch it
    window.parent.postMessage({action: PreviewAction.Pong}, document.referrer)
    addEventListener('message', handleMessage)
    console.log('[Alinea preview listener attached]')

    function fetchAndSendMetadata() {
      const meta = fetchMetadataFromDocument()
      window.parent.postMessage(
        {action: PreviewAction.Meta, ...meta},
        document.referrer
      )
    }
    try {
      fetchAndSendMetadata()
      observer = new MutationObserver(mutationList => {
        console.log('mutationList', mutationList)
        fetchAndSendMetadata()
      })
      observer.observe(document.head, {childList: true})
      console.log('[Alinea meta data send to parent]')
    } catch (e) {
      console.error('[Alinea meta data send to parent failed]')
    }
  }
  return () => {
    if (observer) observer.disconnect()
    removeEventListener('message', handleMessage)
  }
}

function fetchMetadataFromDocument(): PreviewMetadata {
  return {
    title: document.title,
    description: fetchData('meta[name="description"]'),

    language: fetchData('meta[name="language"]'),
    robots: fetchData('meta[name="robots"]'),
    canonical: fetchData('link[rel="canonical"]', 'href'),

    'og:title': fetchData('meta[property="og:title"]'),
    'og:description': fetchData('meta[property="og:description"]'),
    'og:url': fetchData('meta[property="og:url"]'),
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
