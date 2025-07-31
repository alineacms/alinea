export function assert(value: unknown, message?: string): asserts value {
  if (value) return
  const error = new Error(message)
  if ('captureStackTrace' in Error) Error.captureStackTrace(error, assert)
  throw error
}
