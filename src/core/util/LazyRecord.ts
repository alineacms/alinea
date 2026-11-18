/**
 * A record whose keys are read from `keys` each time they are asked for and
 * whose values are made from them once, when first read. Shapes of types
 * that contain themselves close the loop through one, as a schema can be
 * filled in after the fields that hold it were made.
 */
export function lazyRecord<T>(
  keys: () => Array<string>,
  make: (key: string) => T
): Record<string, T> {
  const made = new Map<string, T>()
  const has = (key: string | symbol): key is string =>
    typeof key === 'string' && keys().includes(key)
  const value = (key: string) => {
    if (!made.has(key)) made.set(key, make(key))
    return made.get(key)!
  }
  return new Proxy({} as Record<string, T>, {
    get: (_, key) => (has(key) ? value(key) : undefined),
    has: (_, key) => has(key),
    ownKeys: () => keys(),
    getOwnPropertyDescriptor(_, key) {
      if (!has(key)) return undefined
      return {
        value: value(key),
        enumerable: true,
        configurable: true,
        writable: false
      }
    }
  })
}
