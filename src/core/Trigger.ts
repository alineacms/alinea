const {assign} = Object

export interface Trigger<T> extends Promise<T> {
  resolve(value: T): void
  reject(reason?: any): void
}

export function trigger<T>(): Trigger<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: any) => void
  const promise = new Promise<T>((...args) => ([resolve, reject] = args))
  return assign(promise, {resolve, reject})
}
