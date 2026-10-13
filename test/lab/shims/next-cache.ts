/**
 * `next/cache` for lab isolates: one data cache on the page serves every
 * isolate of a deployment, like the shared data cache of a Next.js host. A
 * stale entry answers right away and refreshes in the background.
 */
import {callMain, trace} from '../shared/realm.js'

interface CacheOptions {
  revalidate?: number | false
  tags?: Array<string>
}

interface Lookup {
  found: boolean
  stale?: boolean
  value?: unknown
}

export function unstable_cache<Args extends Array<unknown>, T>(
  fetcher: (...args: Args) => Promise<T>,
  keyParts: Array<string> = [],
  options: CacheOptions = {}
) {
  return async (...args: Args): Promise<T> => {
    const key = JSON.stringify([...keyParts, ...args])
    const lookup = await callMain<Lookup>('cache.lookup', {key})
    const refresh = async () => {
      const value = await fetcher(...args)
      await callMain('cache.store', {
        key,
        value,
        revalidate: options.revalidate ?? false,
        tags: options.tags ?? []
      })
      return value
    }
    if (!lookup.found) {
      trace({
        node: 'cms',
        kind: 'cache',
        text: `data cache miss ${keyParts[0]}`
      })
      return refresh()
    }
    if (lookup.stale) {
      trace({
        node: 'cms',
        kind: 'cache',
        text: `data cache stale ${keyParts[0]}: answer stale, refresh in background`
      })
      void refresh().catch(() => {})
    }
    return lookup.value as T
  }
}

export function revalidateTag(tag: string, profile?: string) {
  void callMain('cache.revalidateTag', {tag, profile})
}

export function revalidatePath() {}
