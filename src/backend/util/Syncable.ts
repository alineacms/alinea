import pLimit from 'p-limit'

export function createThrottledSync(): (
  sync: () => Promise<unknown>,
  interval?: number
) => Promise<void> {
  // Start unset so a fresh isolate syncs on first use instead of serving
  // its build-time snapshot for a full interval (cold-start staleness).
  let lastSync = 0
  const limit = pLimit(1)
  return async function throttle(
    sync: () => Promise<unknown>,
    intervalSeconds = 60
  ): Promise<void> {
    return limit(async () => {
      if (intervalSeconds === Number.POSITIVE_INFINITY) return
      const now = Date.now()
      if (now - lastSync < intervalSeconds * 1000) return
      lastSync = now
      await sync()
    })
  }
}
