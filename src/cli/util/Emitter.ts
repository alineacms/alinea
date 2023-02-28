export interface Emitter<T> extends AsyncIterable<T> {
  emit(value: T): void
  throw(error: any): void
  cancel(): void
  return(): void
}

export namespace Emitter {
  export const CANCELLED = 'EMIT_CANCELLED'
}

type QueueItem<T> = {type: 'emit' | 'error' | 'finish'; value?: T}

export function createEmitter<T>(): Emitter<T> {
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
      push({type: 'error', value: e})
    },
    cancel() {
      this.throw(Emitter.CANCELLED)
    },
    return() {
      queue.push({type: 'finish'})
    },
    [Symbol.asyncIterator]() {
      return iterator
    }
  }
}
