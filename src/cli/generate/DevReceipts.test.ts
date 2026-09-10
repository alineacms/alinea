import {expect, spyOn, test} from 'bun:test'
import {mkdtemp, mkdir, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {Config, Field} from '#/index.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {Entry} from '#/core/Entry.js'
import {DevDB} from './DevDB.js'
import {DevReceipts} from './DevReceipts.js'
import {createCMS} from '#/core.js'
import {role} from '#/core/Role.js'
import {Client} from '#/core/Client.js'
import {createHandler} from '#/backend/Handler.js'
import {composeBackend} from '#/backend/api/CreateBackend.js'

async function fixture() {
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-dev-receipt-'))
  await mkdir(join(rootDir, 'content'))
  const Page = Config.document('Page', {fields: {title: Field.text('Title')}})
  const config = {
    roles: {
      writer: role('Writer', {
        permissions(policy) {
          policy.allowAll()
        }
      })
    },
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages')}
      })
    }
  }
  const options = {
    config,
    rootDir,
    dashboardUrl: undefined,
    replica: {
      directory: join(rootDir, 'cache'),
      identity: {
        project: 'project',
        namespace: 'main',
        epoch: '1',
        schemaId: 'schema',
        configId: 'config',
        releaseId: 'release'
      }
    }
  }
  const db = new DevDB(options)
  const initial = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Before'}
  ])
  await db.syncWith(initial.source)
  const request = {
    ...(await db.request([
      {
        op: 'update',
        id: 'a',
        locale: null,
        status: 'published',
        set: {title: 'After'}
      }
    ])),
    user: {sub: 'user'},
    transaction: {
      id: 'transaction',
      namespace: 'main',
      epoch: '1',
      digest: 'a'.repeat(64)
    }
  }
  return {
    db,
    options,
    request,
    async cleanup() {
      await db.close()
      await rm(rootDir, {recursive: true, force: true})
    }
  }
}

test('filesystem receipts deduplicate response-lost edits across restart and later source changes', async () => {
  const state = await fixture()
  let reopened: DevDB | undefined
  const apply = spyOn(state.db.source, 'applyChanges')
  try {
    const accepted = await state.db.write(state.request)
    expect(await state.db.write(state.request)).toEqual(accepted)
    expect(apply).toHaveBeenCalledTimes(1)
    await state.db.close()
    reopened = new DevDB(state.options)
    await reopened.sync()
    expect(await reopened.receipt('user', state.request.transaction)).toEqual({
      sha: accepted.sha,
      authorization: state.request.authorization!
    })
    await reopened.mutate([
      {
        op: 'update',
        id: 'a',
        locale: null,
        status: 'published',
        set: {title: 'Later'}
      }
    ])
    expect(
      (await reopened.receipt('user', state.request.transaction))?.sha
    ).toBe(accepted.sha)
    expect(await reopened.first({select: Entry.title})).toBe('Later')
    expect(
      await reopened.receipt('other', state.request.transaction)
    ).toBeUndefined()
    await expect(
      reopened.receipt('user', {
        ...state.request.transaction,
        digest: 'b'.repeat(64)
      })
    ).rejects.toThrow('already used')
    await expect(
      reopened.receipt('user', {...state.request.transaction, epoch: 'other'})
    ).rejects.toThrow('scope mismatch')
  } finally {
    apply.mockRestore()
    await reopened?.close()
    await state.cleanup()
  }
})

test('restart recovers a materialized target whose acceptance marker was interrupted', async () => {
  const state = await fixture()
  const accept = spyOn(DevReceipts.prototype, 'accept').mockRejectedValueOnce(
    new Error('Interrupted acceptance')
  )
  let reopened: DevDB | undefined
  try {
    await expect(state.db.write(state.request)).rejects.toThrow(
      'Interrupted acceptance'
    )
    accept.mockRestore()
    await state.db.close()
    reopened = new DevDB(state.options)
    await reopened.sync()
    expect(
      (await reopened.receipt('user', state.request.transaction))?.sha
    ).toBe(state.request.intoSha)
    expect(await reopened.first({select: Entry.title})).toBe('After')
  } finally {
    accept.mockRestore()
    await reopened?.close()
    await state.cleanup()
  }
})

test('an interrupted file update blocks publication and replay instead of inventing acceptance', async () => {
  const state = await fixture()
  const apply = spyOn(state.db.source, 'applyChanges').mockRejectedValueOnce(
    new Error('Interrupted files')
  )
  let reopened: DevDB | undefined
  try {
    await expect(state.db.write(state.request)).rejects.toThrow(
      'Interrupted files'
    )
    apply.mockRestore()
    await state.db.close()
    reopened = new DevDB(state.options)
    await expect(reopened.sync()).rejects.toThrow('explicit recovery')
    await expect(
      reopened.receipt('user', state.request.transaction)
    ).rejects.toThrow('explicit recovery')
  } finally {
    apply.mockRestore()
    await reopened?.close()
    await state.cleanup()
  }
})

test('the real dev handler recovers an HTTP response-lost transaction after restarting its database', async () => {
  const state = await fixture()
  let db = state.db
  let prepared = 0
  let lost = false
  const context = {
    apiKey: 'dev',
    handlerUrl: new URL('http://localhost/api'),
    isDev: true
  }
  function handler() {
    return createHandler({
      cms: createCMS(state.options.config),
      db,
      beforeCommit() {
        prepared++
      },
      remote(context) {
        return composeBackend(db, {
          async verify() {
            return {
              ...context,
              token: 'dev',
              user: {sub: 'user', roles: ['writer']}
            }
          },
          async enrichUser(user) {
            return user
          }
        })
      }
    })
  }
  let handle = handler()
  const client = new Client({
    config: state.options.config,
    url: context.handlerUrl.href,
    async fetch(url, init) {
      const response = await handle(new Request(url, init), context)
      if (
        new URL(String(url)).searchParams.get('action') === 'mutate' &&
        response.ok &&
        !lost
      ) {
        lost = true
        throw new Error('Lost response')
      }
      return response
    }
  })
  try {
    const {project, namespace, epoch, schemaId, configId} =
      await db.replicaIdentity()
    const expected = {
      project,
      namespace,
      epoch,
      schemaId,
      configId,
      principal: 'user',
      baseRevision: db.sha
    }
    const mutations = [
      {
        op: 'update' as const,
        id: 'a',
        locale: null,
        status: 'published' as const,
        set: {title: 'HTTP accepted'}
      }
    ]
    await expect(
      client.mutate(mutations, 'http-retry', expected)
    ).rejects.toThrow('Lost response')
    expect(await db.first({select: Entry.title})).toBe('HTTP accepted')
    await db.close()
    db = new DevDB(state.options)
    await db.sync()
    handle = handler()
    const result = await client.mutate(mutations, 'http-retry', expected)
    expect(result.sha).toBe(db.sha)
    expect(prepared).toBe(1)
  } finally {
    await db.close()
    await state.cleanup()
  }
})
