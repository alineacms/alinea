import {createBackend} from '#/backend/api/CreateBackend.js'
import type {Config} from '#/core/Config.js'
import type {RequestContext} from '#/core/Connection.js'
import {suite} from '@alinea/suite'

const test = suite(import.meta)

const context: RequestContext = {
  apiKey: 'key',
  handlerUrl: new URL('https://example.com/api/cms'),
  isDev: true
}

const config = {} as Config

test('composes backend parts into a connection', async () => {
  const backend = createBackend(
    {
      authenticate: async () => new Response('auth'),
      verify: async () => ({
        ...context,
        token: 't',
        user: {roles: [], sub: 'u'}
      })
    },
    {
      write: async () => ({sha: 'sha'})
    },
    {
      getDraft: async () => undefined,
      storeDraft: async () => undefined
    },
    {
      revisions: async () => [],
      revisionData: async () => undefined
    },
    {
      getTreeIfDifferent: async () => undefined,
      getBlobs: async function* () {}
    },
    () => ({
      prepareUpload: async () => ({
        entryId: 'entry',
        location: 'media/file.jpg',
        previewUrl: 'https://example.com/file.jpg',
        url: 'https://example.com/upload'
      })
    })
  )

  const connection = backend(context, config)
  test.is((await connection.write({} as never)).sha, 'sha')
  test.is((await connection.prepareUpload('file.jpg')).entryId, 'entry')
})
