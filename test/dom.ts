import {GlobalRegistrator} from '@happy-dom/global-registrator'

// Preloaded (bunfig.toml) so every test file and every module they load sees
// the same DOM globals: test files share one module cache in a `bun test` run,
// and classes such as `extends Event` bind the global of the moment they load.
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
