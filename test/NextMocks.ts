import {mock} from 'bun:test'

/**
 * Module mocks are shared by every test file in a `bun test` run, so the Next
 * adapter tests register their mocks of `next/headers` and the request
 * context once, here, and each file sets this state in its `beforeEach`.
 */
export const nextMocks = {
  cookies: Array<{name: string; value: string}>(),
  draftMode: false,
  enableCalls: 0,
  handlerUrl: new URL('https://example.com/api/cms'),
  apiKey: 'test-api-key'
}

function headers() {
  return {
    cookies: async () => ({getAll: () => nextMocks.cookies}),
    draftMode: async () => ({
      get isEnabled() {
        return nextMocks.draftMode
      },
      enable() {
        nextMocks.enableCalls += 1
      }
    })
  }
}

mock.module('next/headers', headers)
mock.module('next/headers.js', headers)
mock.module('#/adapter/next/context.js', () => ({
  requestContext: async () => ({
    isDev: false,
    handlerUrl: nextMocks.handlerUrl,
    apiKey: nextMocks.apiKey
  })
}))
