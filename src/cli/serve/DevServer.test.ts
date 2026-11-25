import {forwardedMutationHeader} from '#/core/Connection.js'
import {Config} from '#/index.js'
import {createCMS} from '#/core.js'
import {expect, test} from 'bun:test'
import {forwardMutation} from './DevServer.js'

const cms = createCMS({
  schema: {Page: Config.document('Page', {fields: {}})},
  handlerUrl: '/api/cms',
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})

test('commits a mutation the app sent back instead of forwarding it again', async () => {
  // A proxy in front of the dev server adds a forwarded host.
  const request = new Request('http://localhost:4500/api?action=mutate', {
    method: 'POST',
    headers: {
      'x-forwarded-host': 'app.localhost',
      [forwardedMutationHeader]: 'true'
    },
    body: '[]'
  })
  expect(await forwardMutation(request, cms, 'key')).toBeUndefined()
})

test('a compressed answer of the app is passed on decoded', async () => {
  const app = Bun.serve({
    port: 0,
    fetch() {
      return new Response(Bun.gzipSync('{"submissions":[]}'), {
        headers: {
          'content-type': 'application/json',
          'content-encoding': 'gzip'
        }
      })
    }
  })
  try {
    const request = new Request('http://localhost:4500/api?action=mutate', {
      method: 'POST',
      headers: {'x-forwarded-host': `localhost:${app.port}`},
      body: '[]'
    })
    const response = (await forwardMutation(request, cms, 'key'))!
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(await response.json()).toEqual({submissions: []})
  } finally {
    app.stop(true)
  }
})
