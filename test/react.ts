import {GlobalRegistrator} from '@happy-dom/global-registrator'

// Test files share one global scope in a `bun test` run, so the happy-dom
// globals registered here stay in place for every file that runs afterwards.
// Keep the runtime's own network, stream, timer and encoding APIs: happy-dom
// replaces some of them (fetch, Response, TransformStream, ...) with versions
// that do not interoperate with native streams such as CompressionStream.
const nativeGlobals = [
  'fetch',
  'Request',
  'Response',
  'Headers',
  'Blob',
  'File',
  'FormData',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'CompressionStream',
  'DecompressionStream',
  'TextEncoder',
  'TextDecoder',
  'URL',
  'URLSearchParams',
  'AbortController',
  'AbortSignal',
  'WebSocket',
  'crypto',
  'structuredClone',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'queueMicrotask'
] as const

const natives = nativeGlobals.map(
  name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const
)

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register()

for (const [name, descriptor] of natives)
  if (descriptor) Object.defineProperty(globalThis, name, descriptor)

const testingLibrary = await import('@testing-library/react')

export const render = testingLibrary.render
export const screen = testingLibrary.screen
export const within = testingLibrary.within
export const waitFor = testingLibrary.waitFor
export const fireEvent = testingLibrary.fireEvent
export const act = testingLibrary.act
export const cleanup = testingLibrary.cleanup
