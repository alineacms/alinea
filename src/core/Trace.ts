import type {Config} from './Config.js'

export interface Tracer {
  <Result>(name: string, run: () => Promise<Result>): Promise<Result>
}

export interface TraceSpan {
  <Result>(operation: () => Promise<Result>): Promise<Result>
}

export function trace(config: Config, name: string): TraceSpan {
  const tracer = config?.tracer
  if (!tracer) return runDirect

  return async function runSpan<Result>(operation: () => Promise<Result>) {
    let result: Promise<Result> | undefined
    let called = false
    function run() {
      if (called) return result as Promise<Result>
      called = true
      try {
        result = operation()
      } catch (error) {
        result = Promise.reject(error)
      }
      return result
    }

    try {
      await tracer(name, run)
    } catch {
      // The operation result (including its original error) is authoritative.
      // If an exporter failed before calling run, still perform the CMS work.
    }
    return run()
  }
}

function runDirect<Result>(operation: () => Promise<Result>) {
  return operation()
}
