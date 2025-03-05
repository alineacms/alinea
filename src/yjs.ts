// Yjs logs a warning if it is imported multiple times, for good reason.
// However, during development, it's very possible a copy gets bundled while
// another is loaded at runtime.
// See also: https://github.com/yjs/yjs/issues/438
const global = globalThis as any
const importIdentifier = '__ $YJS$ __'
delete global[importIdentifier]

// @ts-ignore
export * from 'yjs-src'
