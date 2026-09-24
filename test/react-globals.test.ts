import {expect, test} from 'bun:test'

const before = {
  fetch: globalThis.fetch,
  Response: globalThis.Response,
  Request: globalThis.Request,
  Blob: globalThis.Blob,
  TransformStream: globalThis.TransformStream,
  CompressionStream: globalThis.CompressionStream,
  TextEncoder: globalThis.TextEncoder
}

// Registers happy-dom for this and every following test file in the run
await import('#test/react.js')

test('happy-dom keeps the native fetch, stream and compression globals', async () => {
  expect(typeof document).toBe('object')
  for (const [name, value] of Object.entries(before))
    expect(globalThis[name as keyof typeof before]).toBe(value)
  const input = new TextEncoder().encode('hello '.repeat(100))
  const compressed = await new Response(
    new Blob([input]).stream().pipeThrough(new CompressionStream('deflate'))
  ).arrayBuffer()
  const output = await new Response(
    new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream('deflate'))
  ).arrayBuffer()
  expect(new Uint8Array(output)).toEqual(input)
})
