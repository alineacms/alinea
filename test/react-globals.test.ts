import {expect, test} from 'bun:test'

// happy-dom is registered for every test file by the preload in bunfig.toml
const natives = {
  fetch: globalThis.fetch,
  Response: globalThis.Response,
  Request: globalThis.Request,
  Blob: globalThis.Blob,
  TransformStream: globalThis.TransformStream,
  CompressionStream: globalThis.CompressionStream,
  TextEncoder: globalThis.TextEncoder
}

test('happy-dom keeps the native fetch, stream and compression globals', async () => {
  expect(typeof document).toBe('object')
  for (const value of Object.values(natives))
    expect(Function.prototype.toString.call(value)).toContain('[native code]')
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
