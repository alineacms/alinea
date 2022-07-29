export enum PreviewAction {
  Ping = '[alinea-ping]',
  Pong = '[alinea-pong]',
  Reload = '[alinea-reload]',
  Refetch = '[alinea-refetch]',
  Previous = '[alinea-previous]',
  Next = '[alinea-next]'
}

export type PreviewApi = {
  refetch?: () => void
  setIsPreviewing?: (isPreviewing: boolean) => void
}

export function registerPreview(api: PreviewApi = {}) {
  if (typeof window === 'undefined') return
  function handleMessage(event: MessageEvent<string>) {
    switch (event.data) {
      case PreviewAction.Reload:
        console.log('[Alinea preview reload received]')
        return location.reload()
      case PreviewAction.Refetch:
        console.log('[Alinea preview refetch received]')
        return api.refetch ? api.refetch() : location.reload()
      case PreviewAction.Previous:
        console.log('[Alinea preview previous received]')
        return history.back()
      case PreviewAction.Next:
        console.log('[Alinea preview next received]')
        return history.forward()
      case PreviewAction.Ping:
        console.log('[Alinea preview ping received]')
        api.setIsPreviewing?.(true)
        return window.top!.postMessage(PreviewAction.Pong, event.origin)
    }
  }
  if (window.location != window.parent.location)
    window.top!.postMessage(PreviewAction.Pong, document.referrer)
  addEventListener('message', handleMessage)
  console.log('[Alinea preview listener attached]')
  return () => {
    removeEventListener('message', handleMessage)
  }
}
