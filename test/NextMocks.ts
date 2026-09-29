import {forwardDevelopmentCredentials} from '#/adapter/next/ForwardCredentials.js'
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
  apiKey: 'test-api-key',
  /** The dev server's handler, while a test runs under `alinea dev`. */
  devHandlerUrl: undefined as URL | undefined
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
  requestContext: async (_config: unknown, request?: Request) => {
    const {devHandlerUrl, handlerUrl, apiKey} = nextMocks
    if (!devHandlerUrl) return {isDev: false, handlerUrl, apiKey}
    return {
      isDev: true,
      handlerUrl: devHandlerUrl,
      apiKey,
      applyAuth: (init: RequestInit) =>
        forwardDevelopmentCredentials(request, apiKey, init)
    }
  }
}))
