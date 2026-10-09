import {createBackend} from '#/backend/api/CreateBackend.js'
import {DatabaseApi} from '#/backend/api/DatabaseApi.js'
import type {Config} from '#/core/Config.js'
import type {RequestContext} from '#/core/Connection.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {suite} from '@alinea/suite'
import {Database as BunSqlite} from 'bun:sqlite'
import * as driver from 'rado/driver'

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

test('answers blobs from a blob store before the remote', async () => {
  const encoder = new TextEncoder()
  const contents = '{"title": "Home"}'
  const blob = encoder.encode(contents)
  const sha = await hashBlob(blob)
  const committed = '{"title": "Saved"}'
  const committedSha = await hashBlob(encoder.encode(committed))
  const store = new DatabaseApi(context, {
    db: driver['bun:sqlite'](new BunSqlite(':memory:'))
  })
  const fromRemote = Array<string>()
  const backend = createBackend(
    {
      async *getBlobs(shas) {
        for (const requested of shas) {
          fromRemote.push(requested)
          yield [requested, blob] as [string, Uint8Array]
        }
      },
      async write() {
        return {sha: 'into-sha'}
      }
    },
    store
  )
  const cnx = backend(context, config)
  const read = async (shas: Array<string>) => {
    const blobs = Array<string>()
    for await (const [sha] of cnx.getBlobs(shas)) blobs.push(sha)
    return blobs
  }

  test.equal(await read([sha]), [sha])
  test.equal(await read([sha]), [sha])
  test.equal(fromRemote, [sha])

  await cnx.write({
    description: 'Save',
    fromSha: 'from-sha',
    intoSha: 'into-sha',
    changes: [
      {
        op: 'addContent',
        path: 'page.json',
        sha: committedSha,
        contents: committed
      },
      // Content that does not hash to its sha is not kept
      {op: 'addContent', path: 'wrong.json', sha: 'f'.repeat(40), contents: 'x'}
    ]
  })
  test.equal(await read([committedSha]), [committedSha])
  test.equal(fromRemote, [sha])
  test.equal([...(await store.readBlobs(['f'.repeat(40)])).keys()], [])
})
