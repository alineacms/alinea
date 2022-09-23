import {effect, Signal} from 'usignal'

export type Task<T> = [result: Signal<T>, stop: () => void]

const noop = () => {}

export function after<T>(
  task: Task<T>,
  react: (value: T) => void | (() => void) | Promise<() => void>
): () => Promise<void> {
  const [result, stop] = task
  let cleanup = Promise.resolve(noop)
  const dispose = effect(() => {
    const current = result.value
    cleanup = cleanup.then(async cleanupPrevious => {
      cleanupPrevious()
      return Promise.resolve(react(current)).then(res => res || noop)
    })
  })
  return async () => {
    dispose()
    ;(await cleanup)()
    stop()
  }
}
