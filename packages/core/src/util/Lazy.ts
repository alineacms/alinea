export type Lazy<T> = T | (() => T)

export namespace Lazy {
  export function get<T>(lazy: Lazy<T>): T {
    return typeof lazy === 'function' ? (lazy as Function)() : lazy
  }
}
