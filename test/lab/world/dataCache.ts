/**
 * The data cache of the Next.js host, which every isolate shares. Alinea
 * keeps the latest content sha in it (`syncIfStale`) under the
 * `alinea-content-sha` tag that commits revalidate. Entries go stale after
 * their revalidate time or when their tag is revalidated, and then answer
 * once more while the isolate that read them refreshes them.
 */
import {bus} from './bus.js'
import {network} from './network.js'

export interface CacheEntry {
  key: string
  value: unknown
  storedAt: number
  revalidate: number | false
  tags: Array<string>
  /** Marked stale by a revalidated tag. */
  revalidated: boolean
}

class DataCache {
  node = 'data-cache'
  entries = new Map<string, CacheEntry>()

  isStale(entry: CacheEntry) {
    if (entry.revalidated) return true
    if (entry.revalidate === false) return false
    return bus.now() - entry.storedAt >= entry.revalidate * 1000
  }

  lookup(key: string) {
    const entry = this.entries.get(key)
    if (!entry) return {found: false}
    return {found: true, stale: this.isStale(entry), value: entry.value}
  }

  store(entry: Omit<CacheEntry, 'storedAt' | 'revalidated'>) {
    this.entries.set(entry.key, {
      ...entry,
      storedAt: bus.now(),
      revalidated: false
    })
    bus.patchState(this.node, {version: Math.random()})
  }

  revalidateTag(tag: string, from: string) {
    let count = 0
    for (const entry of this.entries.values())
      if (entry.tags.includes(tag)) {
        entry.revalidated = true
        count++
      }
    bus.log({
      node: this.node,
      kind: 'revalidate',
      text: `${from} revalidated tag ${tag}: ${count} entr${count === 1 ? 'y' : 'ies'} stale, the next read refreshes`
    })
    bus.patchState(this.node, {version: Math.random()})
  }

  purge() {
    this.entries.clear()
    bus.log({node: this.node, kind: 'purge', text: 'data cache purged'})
    bus.patchState(this.node, {version: Math.random()})
  }
}

export const dataCache = new DataCache()

function label(key: string) {
  try {
    return JSON.parse(key)[0]
  } catch {
    return key
  }
}

network.rpc('cache.lookup', ({key}: {key: string}, from) => {
  const result = dataCache.lookup(key)
  bus.send({
    from,
    to: dataCache.node,
    label: `get ${label(key)}`,
    duration: 120,
    kind: 'event'
  })
  if (result.found)
    bus.log({
      node: dataCache.node,
      kind: result.stale ? 'stale' : 'hit',
      text: `${from}: ${result.stale ? 'stale' : 'fresh'} ${label(key)} = ${String(result.value).slice(0, 7)}`
    })
  else
    bus.log({
      node: dataCache.node,
      kind: 'miss',
      text: `${from}: miss ${label(key)}`
    })
  return result
})

network.rpc(
  'cache.store',
  (
    entry: {
      key: string
      value: unknown
      revalidate: number | false
      tags: Array<string>
    },
    from
  ) => {
    dataCache.store(entry)
    bus.send({
      from,
      to: dataCache.node,
      label: `set ${label(entry.key)}`,
      duration: 120,
      kind: 'event'
    })
    bus.log({
      node: dataCache.node,
      kind: 'store',
      text: `${from}: stored ${label(entry.key)} = ${String(entry.value).slice(0, 7)} for ${entry.revalidate}s`
    })
  }
)

network.rpc('cache.revalidateTag', ({tag}: {tag: string}, from) => {
  bus.send({
    from,
    to: dataCache.node,
    label: `revalidateTag ${tag}`,
    duration: 120,
    kind: 'event'
  })
  dataCache.revalidateTag(tag, from)
})
