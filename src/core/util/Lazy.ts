export type Lazy<T> = T | (() => T)

export namespace Lazy {
  const memo = new WeakMap()
  export function get<T>(lazy: Lazy<T>): T {
    if (typeof lazy === 'function') {
      if (memo.has(lazy)) return memo.get(lazy)
      const value = (lazy as Function)()
      memo.set(lazy, value)
      return value
    }
    return lazy
  }
}
