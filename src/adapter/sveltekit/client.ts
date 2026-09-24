import type {PreviewRefreshDetail} from '#/preview/client.js'

/**
 * Refresh draft pages in place while their content is edited, instead of
 * reloading them. Call it in `src/hooks.client.ts` with `invalidateAll` from
 * `$app/navigation`, which reruns the load functions of the current page.
 * Returns a function that stops listening.
 */
export function refreshPreviews(refresh: () => Promise<unknown>): () => void {
  if (typeof window === 'undefined') return () => {}
  function handle(event: CustomEvent<PreviewRefreshDetail>) {
    event.preventDefault()
    refresh().finally(event.detail.done)
  }
  addEventListener('alinea:refresh', handle)
  return () => removeEventListener('alinea:refresh', handle)
}
