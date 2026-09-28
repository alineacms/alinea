import {forwardedMutationHeader} from '#/core/Connection.js'
import {Config} from '#/index.js'
import {createCMS} from '#/core.js'
import {expect, test} from 'bun:test'
import {forwardMutation} from './DevServer.js'

const cms = createCMS({
  schema: {Page: Config.document('Page', {fields: {}})},
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
