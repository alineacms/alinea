export function trigger<T>() {
  let resolve: (value: T) => void,
    promise = new Promise<T>(_ => (resolve = _))
  return [promise, resolve!] as const
}
