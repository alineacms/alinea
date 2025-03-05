export interface Emitter<T> extends AsyncIterable<T> {
  emit(value: T): void
  throw(error: any): void
  return(): void
}

type QueueItem<T> = {type: 'emit' | 'error' | 'finish'; value?: T}

export interface EmitterOptions {
  onReturn?: () => void
  onThrow?: (error: any) => void
}

export function createEmitter<T>({
  onReturn,
  onThrow
}: EmitterOptions = {}): Emitter<T> {
  const queue: Array<QueueItem<T>> = []
  let resolve: (() => void) | undefined

  const push = (p: QueueItem<T>) => {
    queue.push(p)
    if (resolve) {
      resolve()
      resolve = undefined
    }
  }

  const iterator: AsyncIterator<T> = {
    async next() {
      while (!queue.length) {
        await new Promise<void>(_ => (resolve = _))
      }
      const current = queue.pop()!
      switch (current.type) {
        case 'emit':
          return {value: current.value!, done: false}
        case 'error':
          throw current.value
        case 'finish':
          return {value: undefined, done: true}
      }
    }
  }

  return {
    emit: (value: T) => push({type: 'emit', value}),
    throw(e: any) {
      onThrow?.(e)
      push({type: 'error', value: e})
    },
    return() {
      onReturn?.()
      push({type: 'finish'})
    },
    [Symbol.asyncIterator]() {
      return iterator
    }
  }
}
