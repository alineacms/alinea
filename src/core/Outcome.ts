export type Outcome<T = unknown> = [T, undefined] | [undefined, Error]

export function outcome<T>(promised: Promise<T>): Promise<Outcome<T>>
export function outcome<T>(run: () => Promise<T>): Promise<Outcome<T>>
export function outcome<T>(run: () => T): Outcome<T>
export function outcome(run: Function | Promise<unknown>) {
  try {
    if (typeof run === 'function') {
      const result = run()
      if (isPromiseLike(result)) return outcome(result)
      return [result]
    }
    if (isPromiseLike(run))
      return run.then(v => [v]).catch(err => [undefined, err])
    return [run]
  } catch (error) {
    return [undefined, error]
  }
}

function isPromiseLike(value: any): value is Promise<unknown> {
  return value && typeof value === 'object' && 'then' in value
}
