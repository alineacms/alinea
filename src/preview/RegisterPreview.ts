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
  if (window.location != window.parent.location) {
    // On first load send a pong because we might have missed ping,
    // this can warn in the console but it seems we cannot catch it
    window.parent.postMessage({action: PreviewAction.Pong}, document.referrer)
    addEventListener('message', handleMessage)
    console.log('[Alinea preview listener attached]')

    try {
      const meta = fetchMetadataFromDocument()
      window.parent.postMessage(
        {action: PreviewAction.Meta, ...meta},
        document.referrer
      )
      console.log('[Alinea meta data send to parent]')
    } catch (e) {
      console.error('[Alinea meta data send to parent failed]')
    }
  }
  return () => {
    removeEventListener('message', handleMessage)
  }
}

function fetchMetadataFromDocument(): PreviewMetadata {
  function fetchData(selector: string): string | undefined {
    return (
      document.querySelector(selector)?.getAttribute('content') || undefined
    )
  }

  return {
    title: document.title,
    description: fetchData('meta[name="description"]'),
    'og:title': fetchData('meta[property="og:title"]'),
    'og:description': fetchData('meta[property="og:description"]'),
    'og:url': fetchData('meta[property="og:url"]'),
    'og:image': fetchData('meta[property="og:image"]')
  }
}
