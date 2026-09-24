import type {
  HostCookie,
  HostRequest,
  ServerHost
} from '#/adapter/core/ServerHost.js'
import {outcome} from '#/core/Outcome.js'
import {cache} from 'react'

// Tag for the shared latest-content-sha entry. The Next handler wrapper
// revalidates it after every commit, so renders learn about new content
// instantly. The time-based revalidate below is only a safety net for edits
// that bypass the handler (direct cloud writes).
export const CONTENT_SHA_TAG = 'alinea-content-sha'
const SHA_REVALIDATE_SECONDS = 60

// In-flight dedup so concurrent renders share one sha fetch.
let inflight: Promise<string | undefined> | undefined

class NextRequest implements HostRequest {
  #isDraft: Promise<boolean> | undefined

  async cookies(): Promise<Array<HostCookie>> {
    try {
      const {cookies} = await import('next/headers.js')
      return (await cookies()).getAll()
    } catch {
      return []
    }
  }

  isDraft(): Promise<boolean> {
    return (this.#isDraft ??= (async () => {
      const {draftMode} = await import('next/headers.js')
      const [isDraft] = await outcome(async () => (await draftMode()).isEnabled)
      return Boolean(isDraft)
    })())
  }

  async enableDraft(): Promise<void> {
    const {draftMode} = await import('next/headers.js')
    ;(await draftMode()).enable()
  }
}

async function loadLatestSha(
  load: () => Promise<string | undefined>
): Promise<string | undefined> {
  try {
    const {unstable_cache} = await import('next/cache.js')
    // The wrapper is created per call on purpose: the fetcher closes over
    // the request-scoped client, so it must not be hoisted to module scope.
    // Sharing still works because the cache key derives from this
    // function's source plus keyParts, not its identity.
    const getSha = unstable_cache(load, ['alinea-content-sha'], {
      revalidate: SHA_REVALIDATE_SECONDS,
      tags: [CONTENT_SHA_TAG]
    })
    return await getSha()
  } catch {
    // Outside Next runtime (tests, edge): direct fetch.
    try {
      return await load()
    } catch {
      return undefined
    }
  }
}

export const nextHost: ServerHost = {
  /**
   * Per React request; outside a request (build, route handlers) every call
   * returns a fresh request, so nothing is recorded there.
   */
  current: cache((): HostRequest => new NextRequest()),
  // Route handlers can read the request through next/headers.
  forRequest() {
    return new NextRequest()
  },
  async isBuild() {
    const {PHASE_PRODUCTION_BUILD} = await import('next/constants.js')
    return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
  },
  isEdge() {
    return process.env.NEXT_RUNTIME === 'edge'
  },
  latestSha(load) {
    if (inflight) return inflight
    inflight = loadLatestSha(load).finally(() => {
      inflight = undefined
    })
    return inflight
  },
  async revalidate() {
    try {
      const {revalidateTag} = await import('next/cache.js')
      // {expire: 0} expires immediately: required on Next 16+, where the bare
      // single-arg form is deprecated and the default became
      // stale-while-revalidate. On older Next the extra argument is ignored
      // and immediate expiry was the only behavior.
      revalidateTag(CONTENT_SHA_TAG, {expire: 0})
    } catch {
      // Not in a Next runtime, nothing shared to invalidate.
    }
  }
}
