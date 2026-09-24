import {setPreviewCookies} from './PreviewCookies.js'
import {registerPreview} from './RegisterPreview.js'
import {type PreviewStats, registerPreviewWidget} from './widget.js'

export interface MountPreviewsOptions {
  /** The dashboard the widget links to and previews are received from. */
  dashboardUrl: string
  /** Show the preview widget. */
  widget?: boolean
  /** The queries and syncs of the render, shown in the widget. */
  stats?: PreviewStats
  workspace?: string
  root?: string
}

/**
 * The detail of the cancelable `alinea:refresh` event, dispatched on window
 * once a preview update is ready to render. Frameworks that can refresh
 * without reloading call `preventDefault()` and `done()` once refreshed.
 * Otherwise the page reloads.
 */
export interface PreviewRefreshDetail {
  done(): void
}

declare global {
  interface WindowEventMap {
    'alinea:refresh': CustomEvent<PreviewRefreshDetail>
  }
}

interface ReloadState {
  payload: string
  x: number
  y: number
}

const RELOAD_KEY = 'alinea:preview'

/** Receive live previews from the dashboard, returns a cleanup function. */
export function mountPreviews(options: MountPreviewsOptions): () => void {
  const {dashboardUrl, widget, stats, workspace, root} = options
  const adminUrl = new URL(dashboardUrl, location.origin)
  const host = window.parent !== window ? window.parent : window.opener
  let hostOrigin = adminUrl.origin
  try {
    if (host?.location.origin === location.origin) hostOrigin = location.origin
  } catch {
    // A cross-origin dashboard is expected when using the CLI directly.
  }
  const reloaded = restoreReload()
  // The dashboard sends its current preview to every page that connects,
  // including the one reloaded to show it.
  let applied = reloaded?.payload
  let isPreviewing = false
  let isLoading = false
  let previewDisabled = false
  let element: HTMLElement | undefined
  if (widget) {
    registerPreviewWidget()
    element = document.createElement('alinea-preview')
    element.setAttribute('adminurl', String(adminUrl))
    if (stats) element.setAttribute('stats', JSON.stringify(stats))
    update()
    document.body.append(element)
  }
  const unregister = registerPreview(
    {
      async preview(preview) {
        if (!preview || preview.payload === applied) return
        const success = await setPreviewCookies(preview.payload)
        previewDisabled = !success
        if (success) {
          applied = preview.payload
          isLoading = true
          update()
          await refresh(preview.payload)
          isLoading = false
        }
        update()
      },
      setIsPreviewing(value) {
        isPreviewing = value
        update()
      }
    },
    hostOrigin
  )
  return () => {
    unregister?.()
    element?.remove()
  }

  function update() {
    if (!element) return
    const params = new URLSearchParams({url: location.pathname})
    if (workspace) params.set('workspace', workspace)
    if (root) params.set('root', root)
    element.setAttribute(
      'editurl',
      String(new URL(`#/edit?${params}`, adminUrl))
    )
    const state = isPreviewing
      ? isLoading
        ? 'loading'
        : previewDisabled
          ? 'warning'
          : 'connected'
      : undefined
    if (state) element.setAttribute('livepreview', state)
    else element.removeAttribute('livepreview')
  }
}

function refresh(payload: string): Promise<void> {
  return new Promise(resolve => {
    const event = new CustomEvent('alinea:refresh', {
      cancelable: true,
      detail: {done: () => resolve()}
    })
    if (!window.dispatchEvent(event)) return
    const state: ReloadState = {payload, x: scrollX, y: scrollY}
    try {
      sessionStorage.setItem(RELOAD_KEY, JSON.stringify(state))
    } catch {
      // Without storage the page reloads at the browser's scroll position.
    }
    location.reload()
  })
}

function restoreReload(): ReloadState | undefined {
  let state: ReloadState | undefined
  try {
    const stored = sessionStorage.getItem(RELOAD_KEY)
    sessionStorage.removeItem(RELOAD_KEY)
    if (stored) state = JSON.parse(stored)
  } catch {
    return
  }
  if (!state) return
  const {x, y} = state
  if (document.readyState === 'complete') scrollTo(x, y)
  else addEventListener('load', () => scrollTo(x, y), {once: true})
  return state
}
