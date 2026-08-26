/** Accumulate all entries of an AsyncIterable into an array */
export async function accumulate<T>(gen: AsyncIterable<T>): Promise<Array<T>> {
  const acc = []
  for await (const item of gen) acc.push(item)
  return acc
}

export async function* toGenerator<T>(
  iterable: Iterable<T>
): AsyncGenerator<T> {
  for (const item of iterable) yield item
}

export interface MapConcurrentOptions {
  concurrency: number
  signal?: AbortSignal
}

/** Map concurrently while yielding results as they complete. */
export async function* mapConcurrent<T, TResult>(
  iterable: Iterable<T>,
  mapper: (item: T, signal?: AbortSignal) => Promise<TResult>,
  options: MapConcurrentOptions
): AsyncGenerator<TResult> {
  const {concurrency, signal} = options
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new RangeError('Concurrency must be a positive integer')

  const remaining = iterable[Symbol.iterator]()
  const completed: Array<TResult> = []
  let active = 0
  let stopped = signal?.aborted ?? false
  let failed = false
  let failure: unknown
  let wake: (() => void) | undefined

  function resume() {
    const resolve = wake
    wake = undefined
    resolve?.()
  }

  function complete(result: TResult) {
    active--
    if (stopped || failed) return
    completed.push(result)
    resume()
  }

  function fail(error: unknown) {
    active--
    if (stopped || failed) return
    failed = true
    failure = error
    resume()
  }

  function schedule() {
    if (stopped || failed) return
    const next = remaining.next()
    if (next.done) return
    active++
    try {
      void mapper(next.value, signal).then(complete, fail)
    } catch (error) {
      fail(error)
    }
  }

  function abort() {
    stopped = true
    resume()
  }

  if (!stopped) signal?.addEventListener('abort', abort, {once: true})
  try {
    if (stopped) throw signal?.reason ?? new Error('Operation aborted')
    for (let index = 0; index < concurrency; index++) schedule()
    while (active > 0 || completed.length > 0 || stopped || failed) {
      if (stopped) throw signal?.reason ?? new Error('Operation aborted')
      if (failed) throw failure
      if (completed.length === 0) {
        await new Promise<void>(resolve => {
          wake = resolve
        })
        continue
      }
      const result = completed.shift()!
      schedule()
      yield result
    }
  } finally {
    stopped = true
    signal?.removeEventListener('abort', abort)
  }
}

export function genEffect<T, TReturn>(
  gen: AsyncIterable<T, TReturn>,
  effect: (result: T) => void
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      const iter = gen[Symbol.asyncIterator]()
      const stack: Array<Promise<IteratorResult<T, TReturn>>> = []
      const dispense = () => {
        stack.push(
          iter.next().then(res => {
            if (!res.done) {
              effect(res.value)
              dispense()
            }
            return res
          })
        )
      }
      dispense()
      return {
        next() {
          return stack.shift()!
        }
      }
    }
  }
}
