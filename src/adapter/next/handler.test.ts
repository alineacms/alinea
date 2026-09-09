import {Config} from '#/index.js'
import {sign} from '#/core/util/JWT.js'
import {afterEach, beforeEach, expect, mock, spyOn, test} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {NodeReplica} from '#/database/driver/NodeReplica.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {composeBackend} from '#/backend/api/CreateBackend.js'
import {MissingCredentialsError} from '#/backend/Auth.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import {Entry} from '#/core/Entry.js'
import {getScope} from '#/core/Scope.js'
import {base64} from '#/core/util/Encoding.js'
import {decryptFrame} from '#/database/replica/Frame.js'
import {entryVersionId} from '#/database/entry/Schema.js'
import {HttpPayloadLoader} from '#/database/browser/HttpPayloadLoader.js'

const apiKey = 'preview-secret'
let draftEnabled = false
let enableCalls = 0

mock.module('./context.js', () => ({
  requestContext: async () => ({
    isDev: false,
    handlerUrl: new URL('https://example.com/api/cms'),
    apiKey
  })
}))

mock.module('next/headers', () => ({
  draftMode: async () => ({
    get isEnabled() {
      return draftEnabled
    },
    enable() {
      enableCalls += 1
    }
  })
}))

const [{createCMS}, {createHandler, handlerPathname}] = await Promise.all([
  import('./cms.js'),
  import('./handler.js')
])

const Page = Config.document('Page', {fields: {}})
const cms = createCMS({
  baseUrl: 'https://example.com',
  handlerUrl: '/api/cms',
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})
const handle = createHandler(cms)
let consoleError: ReturnType<typeof spyOn>

test('Node handler queries and authenticated mutations use the SQLite replica', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-next-handler-'))
  const localCms = createCMS(cms.config)
  const {source} = await createEntryResolver(localCms.config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Original'}
  ])
  const replica = await NodeReplica.open(
    {
      config: localCms.config,
      directory,
      identity: {
        project: 'project',
        namespace: 'main',
        epoch: '1',
        schemaId: 'schema',
        configId: 'config',
        releaseId: 'release'
      }
    },
    source
  )
  localCms.bundledDb = Promise.resolve(replica)
  let writes = 0
  let userRoles = ['admin']
  let advanceAfterCommit = false
  const events: Array<string> = []
  const handler = createHandler({
    cms: localCms,
    backend(context) {
      return composeBackend(source, {
        async verify(request) {
          if (request.headers.get('authorization') !== 'Bearer user')
            throw new MissingCredentialsError('Missing user')
          return {
            ...context,
            token: 'test',
            user: {sub: 'editor', roles: userRoles}
          }
        },
        async write(request) {
          writes++
          events.push('remote')
          await source.applyChanges(sourceChanges(request))
          const sha = (await source.getTree()).sha
          if (advanceAfterCommit) {
            const newer = await createEntryResolver(localCms.config, [
              {id: 'a', type: 'Page', index: 'a', title: 'Newer remote edit'}
            ])
            const tree = await source.getTree()
            const next = await newer.source.getTree()
            const {bundleContents} = await import('#/core/source/Source.js')
            await source.applyChanges(
              await bundleContents(newer.source, tree.diff(next))
            )
            await replica.sync(source)
          }
          return {sha}
        }
      })
    },
    beforeCommit() {
      events.push('before')
    },
    afterCommit() {
      events.push('after')
    }
  })
  function request(action: string, body: unknown, credential = apiKey) {
    return new Request(`https://example.com/api/cms?action=${action}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${credential}`
      },
      body: getScope(localCms.config).stringify(body)
    })
  }
  try {
    const query = {first: true, select: Entry.title, id: 'a', disableSync: true}
    const read = await handler(request('resolve', query))
    expect(read.status).toBe(200)
    expect(await read.json()).toBe('Original')
    expect((await handler(request('replicaIndex', {}))).status).toBe(401)
    const bootstrap = await handler(
      request('replicaIndex', {principal: 'forged', roles: []}, 'user')
    )
    expect(bootstrap.status).toBe(200)
    expect(bootstrap.headers.get('cache-control')).toBe('private, no-store')
    expect(bootstrap.headers.get('vary')).toBe('Cookie, Authorization')
    const view = await bootstrap.json()
    expect(view.version).toBe(1)
    expect(view.identity.principal).toBe('editor')
    expect(view.identity.namespace).toBe('main')
    expect(view.revision).toBe(replica.revision)
    expect(
      view.entries.map((row: {entry: {id: string}}) => row.entry.id)
    ).toEqual(['a'])
    expect(view.entries[0].payloadId).toBeString()
    expect(view.entries[0]).not.toHaveProperty('data')
    expect(view.entries[0]).not.toHaveProperty('source')
    expect(view.entries[0].entry).not.toHaveProperty('data')
    const payloadRequest = {
      identity: view.identity,
      revision: view.revision,
      requests: [
        {
          versionId: entryVersionId('a', null, 'published'),
          payloadId: view.entries[0].payloadId
        }
      ]
    }
    expect(
      (await handler(request('replicaPayloads', payloadRequest))).status
    ).toBe(401)
    const payload = await handler(
      request('replicaPayloads', payloadRequest, 'user')
    )
    expect(payload.status).toBe(200)
    expect(payload.headers.get('cache-control')).toBe('private, no-store')
    const encoded = await payload.json()
    expect(encoded.identity).toEqual(view.identity)
    expect(encoded.revision).toBe(view.revision)
    expect(encoded.frames).toHaveLength(1)
    const frame = encoded.frames[0]
    const descriptor = {
      ...frame.descriptor,
      nonce: base64.parse(frame.descriptor.nonce)
    }
    const plaintext = await decryptFrame(
      {...view.identity, ...payloadRequest.requests[0], kind: 'data'},
      descriptor,
      base64.parse(frame.ciphertext),
      base64.parse(frame.key)
    )
    expect(JSON.parse(new TextDecoder().decode(plaintext)).data.title).toBe(
      'Original'
    )
    const browserLoader = new HttpPayloadLoader({
      url: 'https://example.com/api/cms',
      identity: view.identity,
      revision: view.revision,
      applyAuth(init) {
        const headers = new Headers(init.headers)
        headers.set('authorization', 'Bearer user')
        return {...init, headers}
      },
      fetch(url, init) {
        return handler(new Request(url, init))
      }
    })
    try {
      const [loaded] = await browserLoader.load(payloadRequest.requests)
      expect(loaded.data.title).toBe('Original')
    } finally {
      browserLoader.close()
    }
    expect(
      (
        await handler(
          request(
            'replicaPayloads',
            {
              ...payloadRequest,
              identity: {...view.identity, releaseId: 'another-release'}
            },
            'user'
          )
        )
      ).status
    ).toBe(409)
    expect(
      (
        await handler(
          request(
            'replicaPayloads',
            {
              ...payloadRequest,
              identity: {...view.identity, principal: 'someone-else'}
            },
            'user'
          )
        )
      ).status
    ).toBe(409)
    expect(
      (
        await handler(
          request(
            'replicaPayloads',
            {
              ...payloadRequest,
              requests: [...payloadRequest.requests, ...payloadRequest.requests]
            },
            'user'
          )
        )
      ).status
    ).toBe(400)
    expect(
      (
        await handler(
          request(
            'replicaPayloads',
            {
              ...payloadRequest,
              requests: [{versionId: 'hidden', payloadId: 'hidden'}]
            },
            'user'
          )
        )
      ).status
    ).toBe(403)
    expect(
      (await handler(request('replicaPayloads', {malformed: true}, 'user')))
        .status
    ).toBe(400)
    expect(
      (
        await handler(
          request(
            'replicaPayloads',
            {...payloadRequest, padding: 'x'.repeat(65536)},
            'user'
          )
        )
      ).status
    ).toBe(413)
    userRoles = []
    expect(
      (await handler(request('replicaPayloads', payloadRequest, 'user'))).status
    ).toBe(409)
    const revoked = await (
      await handler(request('replicaIndex', {roles: ['admin']}, 'user'))
    ).json()
    expect(revoked.revision).toBe(view.revision)
    expect(revoked.identity.viewId).not.toBe(view.identity.viewId)
    expect(revoked.entries).toEqual([])
    userRoles = ['admin']
    const mutations = [
      {
        op: 'update',
        id: 'a',
        locale: null,
        status: 'published',
        set: {title: 'Updated'}
      }
    ]
    expect((await handler(request('mutate', mutations))).status).toBe(401)
    expect(writes).toBe(0)
    const result = await handler(request('mutate', mutations, 'user'))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({sha: replica.revision})
    expect(
      (await handler(request('replicaPayloads', payloadRequest, 'user'))).status
    ).toBe(409)
    expect(writes).toBe(1)
    expect(events).toEqual(['before', 'remote', 'after'])
    expect(await replica.first({id: 'a', select: Entry.title})).toBe('Updated')
    expect((await source.getTree()).sha).toBe(replica.revision)
    expect(await (await handler(request('resolve', query))).json()).toBe(
      'Updated'
    )
    const entry = await replica.get({id: 'a', select: Entry})
    const preview = await handler(
      request('resolve', {
        ...query,
        preview: {
          entry: {
            ...entry,
            fileHash: 'preview',
            data: {...entry.data, title: 'Preview'}
          }
        }
      })
    )
    expect(preview.status).toBe(200)
    expect(await preview.json()).toBe('Preview')
    expect(await replica.first({id: 'a', select: Entry.title})).toBe('Updated')
    advanceAfterCommit = true
    const raced = await handler(
      request(
        'mutate',
        [{...mutations[0], set: {title: 'Earlier accepted edit'}}],
        'user'
      )
    )
    expect(raced.status).toBe(200)
    expect(writes).toBe(2)
    expect(await raced.json()).toEqual({sha: replica.revision})
    expect(await replica.first({id: 'a', select: Entry.title})).toBe(
      'Newer remote edit'
    )
  } finally {
    await replica.close()
    await rm(directory, {recursive: true, force: true})
  }
})

test('uses the exact pathname of an absolute handler URL', () => {
  const config = {
    ...cms.config,
    handlerUrl: 'https://example.com/api/custom'
  }
  const expected = handlerPathname(config, new URL('http://localhost/request'))

  expect(expected).toBe('/api/custom')
  expect('/api/custom-extra').not.toBe(expected)
})

beforeEach(() => {
  draftEnabled = false
  enableCalls = 0
  consoleError = spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

test('rejects an invalid preview token without a draft session', async () => {
  const response = await previewRequest('invalid')

  expect(response.status).toBe(500)
  expect(response.headers.get('location')).toBeNull()
  expect(enableCalls).toBe(0)
})

test('accepts an expired preview token with an existing draft session', async () => {
  draftEnabled = true
  const response = await previewRequest(await expiredToken(), '/articles/one')

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe(
    'https://example.com/articles/one'
  )
  expect(enableCalls).toBe(1)
})

test.each([false, true])(
  'rejects cross-origin preview redirects when draft mode is %s',
  async isDraftEnabled => {
    draftEnabled = isDraftEnabled
    const token = isDraftEnabled ? await expiredToken() : await validToken()

    for (const returnTo of [
      '//evil.example/path',
      'https://evil.example/path'
    ]) {
      const response = await previewRequest(token, returnTo)
      expect(response.status).toBe(500)
      expect(response.headers.get('location')).toBeNull()
    }
    expect(enableCalls).toBe(0)
  }
)

function previewRequest(token: string, returnTo = '/'): Promise<Response> {
  const url = new URL('https://example.com/api/cms')
  url.searchParams.set('preview', token)
  url.searchParams.set('returnTo', returnTo)
  return handle(new Request(url))
}

function validToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return sign({purpose: 'preview', iat: now, exp: now + 60}, apiKey)
}

function expiredToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return sign({purpose: 'preview', iat: now - 60, exp: now - 1}, apiKey)
}
