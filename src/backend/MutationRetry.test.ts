import {expect, spyOn, test} from 'bun:test'
import {createCMS} from '#/core.js'
import {Client} from '#/core/Client.js'
import {transactionIdHeader, type RequestContext} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import type {CommitReceipt, CommitTransaction} from '#/core/db/CommitRequest.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {MutationContext} from '#/core/db/MutationContext.js'
import {updatePrecondition} from '#/core/db/UpdatePrecondition.js'
import {HttpError} from '#/core/HttpError.js'
import {Config, Field} from '#/index.js'
import {composeBackend} from './api/CreateBackend.js'
import {createHandler} from './Handler.js'

const context: RequestContext = {
  isDev: false,
  apiKey: 'key',
  handlerUrl: new URL('https://cms.test/api')
}

function fixture(
  supported = true,
  binding?: {namespace: string; epoch: string}
) {
  const cms = createCMS({
    replica: {namespace: 'configured-branch', epoch: 'reset-2'},
    schema: {
      Page: Config.document('Page', {
        fields: {title: Field.text('Title'), summary: Field.text('Summary')}
      })
    },
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages')}
      })
    }
  })
  const authority = new LocalDB(cms.config)
  const receipts = new Map<string, CommitReceipt & {digest: string}>()
  const state = {
    writes: 0,
    prepares: 0,
    before: 0,
    after: 0,
    loseResponse: false,
    conflictAfterAcceptance: false,
    conflictBeforeAcceptance: false,
    beforePrepare: undefined as ((db: LocalDB) => Promise<void>) | undefined,
    principal: 'user',
    roles: ['admin'],
    lastTransaction: undefined as CommitTransaction | undefined
  }
  const key = (principal: string, tx: CommitTransaction) =>
    JSON.stringify([principal, tx.namespace, tx.epoch, tx.id])
  function handler() {
    const db = Object.assign(new LocalDB(cms.config), {
      replicaIdentity: binding
        ? async () => ({
            project: 'project',
            schemaId: 'schema',
            configId: 'config',
            ...binding
          })
        : undefined
    })
    const prepare = db.request.bind(db)
    db.request = async (...args) => {
      state.prepares++
      await state.beforePrepare?.(db)
      return prepare(...args)
    }
    return createHandler({
      cms,
      db,
      beforeCommit() {
        state.before++
      },
      afterCommit() {
        state.after++
      },
      remote(ctx) {
        return composeBackend(authority, {
          async verify() {
            return {
              ...ctx,
              token: 'token',
              user: {sub: state.principal, roles: state.roles}
            }
          },
          receipt: supported
            ? async (principal, tx) => {
                const receipt = receipts.get(key(principal, tx))
                if (receipt && receipt.digest !== tx.digest)
                  throw new HttpError(409, 'Transaction ID reused')
                return receipt
              }
            : undefined,
          async write(request) {
            state.writes++
            state.lastTransaction = request.transaction
            if (state.conflictBeforeAcceptance) {
              state.conflictBeforeAcceptance = false
              await authority.mutate([
                {
                  op: 'create',
                  id: 'other',
                  type: 'Page',
                  locale: null,
                  data: {title: 'Other editor'}
                }
              ])
              throw new HttpError(409, 'Source advanced')
            }
            const result = await authority.write(request)
            if (request.transaction)
              receipts.set(key(request.user!.sub, request.transaction), {
                ...result,
                digest: request.transaction.digest,
                authorization: request.authorization!
              })
            if (state.loseResponse) {
              state.loseResponse = false
              throw new Error('Response lost after acceptance')
            }
            if (state.conflictAfterAcceptance) {
              state.conflictAfterAcceptance = false
              throw new HttpError(409, 'Another writer won the source CAS')
            }
            return result
          }
        })
      }
    })
  }
  let handle = handler()
  return {
    state,
    receipts,
    authority,
    client: new Client({
      config: cms.config,
      url: context.handlerUrl.href,
      fetch: Object.assign(
        async (input: RequestInfo | URL, init?: RequestInit) =>
          handle(new Request(input, init), context),
        {preconnect: fetch.preconnect}
      )
    }),
    restart() {
      handle = handler()
    }
  }
}

const create: Array<Mutation> = [
  {op: 'create', id: 'entry', type: 'Page', locale: null, data: {title: 'Page'}}
]

test('Graph HTTP retry recovers accepted creation across handler restart without replaying preparation or hooks', async () => {
  const f = fixture()
  using errors = spyOn(console, 'error').mockImplementation(() => {})
  f.state.loseResponse = true
  await expect(f.client.mutate(create, 'create-tx')).rejects.toThrow(
    'Response lost'
  )
  expect(f.state.writes).toBe(1)
  expect(f.state.lastTransaction).toMatchObject({
    id: 'create-tx',
    namespace: 'configured-branch',
    epoch: 'reset-2'
  })
  expect(f.state.lastTransaction!.digest).toMatch(/^[a-f0-9]{64}$/)
  f.restart()
  const result = await f.client.mutate(create, 'create-tx')
  expect(result).toEqual({sha: f.authority.sha})
  expect(f.state).toMatchObject({writes: 1, prepares: 1, before: 1, after: 0})
  await expect(
    f.client.mutate(
      [{...create[0], data: {title: 'Different'}} as Mutation],
      'create-tx'
    )
  ).rejects.toThrow('Transaction ID reused')
  expect(f.state.writes).toBe(1)
  f.state.roles = []
  await expect(f.client.mutate(create, 'create-tx')).rejects.toThrow(
    'Permission denied'
  )
  expect(f.state.prepares).toBe(1)
})

test('accepted deletion can be acknowledged without requiring the deleted entry to exist', async () => {
  const f = fixture()
  await f.client.mutate(create, 'create-tx')
  const remove: Array<Mutation> = [{op: 'remove', id: 'entry'}]
  const accepted = await f.client.mutate(remove, 'delete-tx')
  f.restart()
  expect(await f.client.mutate(remove, 'delete-tx')).toEqual(accepted)
  expect(f.state).toMatchObject({writes: 2, prepares: 2, before: 2, after: 2})
  f.state.principal = 'other-user'
  await f.client.mutate(create, 'create-tx')
  expect(f.state.writes).toBe(3)
})

test('internal conflict recovery checks receipts before preparing again and uses the loaded replica identity', async () => {
  const f = fixture(true, {
    namespace: 'bundled-preview',
    epoch: 'bundled-epoch'
  })
  f.state.conflictAfterAcceptance = true
  expect(await f.client.mutate(create, 'raced')).toEqual({sha: f.authority.sha})
  expect(f.state).toMatchObject({writes: 1, prepares: 1, before: 1, after: 0})
  expect(f.state.lastTransaction).toMatchObject({
    namespace: 'bundled-preview',
    epoch: 'bundled-epoch'
  })
})

test('transaction opt-in fails explicitly on unsupported backends and rejects malformed IDs', async () => {
  const f = fixture(false)
  await expect(f.client.mutate(create, 'id')).rejects.toThrow(
    'does not support durable mutation retries'
  )
  await expect(f.client.mutate(create, '')).rejects.toThrow(
    'Invalid mutation transaction'
  )
  expect(f.state).toMatchObject({writes: 0, prepares: 0, before: 0})
  expect(await f.client.mutate(create)).toEqual({sha: f.authority.sha})
  expect(f.state.lastTransaction).toBeUndefined()
  expect(transactionIdHeader).toBe('x-alinea-transaction-id')
})

test('context-bound receipts recover across content and schema changes but cannot cross principals or epochs', async () => {
  const binding = {namespace: 'preview/日本語', epoch: '1', schemaId: 'schema'}
  const f = fixture(true, binding)
  const expected: MutationContext = {
    project: 'project',
    namespace: binding.namespace,
    epoch: binding.epoch,
    principal: 'user',
    schemaId: 'schema',
    configId: 'config',
    baseRevision: f.authority.sha
  }
  const accepted = await f.client.mutate(create, 'context', expected)
  binding.schemaId = 'next-schema'
  f.restart()
  expect(await f.client.mutate(create, 'context', expected)).toEqual(accepted)
  expect(f.state).toMatchObject({writes: 1, prepares: 1, before: 1, after: 1})
  await expect(
    f.client.mutate(create, 'context', {...expected, schemaId: 'next-schema'})
  ).rejects.toThrow('Transaction ID reused')
  f.state.principal = 'different-user'
  await expect(f.client.mutate(create, 'context', expected)).rejects.toThrow(
    'another replica identity'
  )
  f.state.principal = 'user'
  binding.epoch = 'reset'
  await expect(f.client.mutate(create, 'context', expected)).rejects.toThrow(
    'another replica identity'
  )
  expect(f.state.writes).toBe(1)
})

test('unaccepted stale intents fail before hooks or preparation instead of overwriting newer content', async () => {
  const f = fixture(true, {namespace: 'preview', epoch: '1'})
  const expected: MutationContext = {
    project: 'project',
    namespace: 'preview',
    epoch: '1',
    principal: 'user',
    schemaId: 'schema',
    configId: 'config',
    baseRevision: f.authority.sha
  }
  for (const field of [
    'project',
    'namespace',
    'epoch',
    'principal',
    'schemaId',
    'configId',
    'baseRevision'
  ] as const)
    await expect(
      f.client.mutate(create, `wrong-${field}`, {...expected, [field]: 'wrong'})
    ).rejects.toThrow()
  await expect(f.client.mutate(create, undefined, expected)).rejects.toThrow(
    'requires a transaction ID'
  )
  expect(f.state).toMatchObject({writes: 0, prepares: 0, before: 0})
  await f.client.mutate(create, 'other-editor')
  const remove: Array<Mutation> = [{op: 'remove', id: 'entry'}]
  await expect(
    f.client.mutate(remove, 'stale-delete', expected)
  ).rejects.toThrow('base revision changed')
  expect(f.state).toMatchObject({writes: 1, prepares: 1, before: 1})
})

test('source races during preparation or authority CAS never silently rebase a context-bound edit', async () => {
  for (const stage of ['preparation', 'authority']) {
    const f = fixture(true, {namespace: 'preview', epoch: '1'})
    const expected: MutationContext = {
      project: 'project',
      namespace: 'preview',
      epoch: '1',
      principal: 'user',
      schemaId: 'schema',
      configId: 'config',
      baseRevision: f.authority.sha
    }
    if (stage === 'preparation')
      f.state.beforePrepare = async db => {
        await f.authority.mutate([
          {
            op: 'create',
            id: 'other',
            type: 'Page',
            locale: null,
            data: {title: 'Other editor'}
          }
        ])
        await db.syncWith(f.authority)
      }
    else f.state.conflictBeforeAcceptance = true
    await expect(
      f.client.mutate(create, 'raced-context', expected)
    ).rejects.toThrow('base revision changed')
    expect(f.state).toMatchObject({
      prepares: 1,
      before: 1,
      after: 0,
      writes: stage === 'preparation' ? 0 : 1
    })
    expect(
      f.authority.index.findFirst(entry => entry.id === 'entry')
    ).toBeUndefined()
    expect(
      f.authority.index.findFirst(entry => entry.id === 'other')
    ).toBeDefined()
  }
})

test('context-bound field edits merge independent changes and reject same-field or structural conflicts', async () => {
  const f = fixture(true, {namespace: 'preview', epoch: '1'})
  await f.client.mutate(create, 'create')
  const entry = f.authority.index.findFirst(entry => entry.id === 'entry')!
  const expected: MutationContext = {
    project: 'project',
    namespace: 'preview',
    epoch: '1',
    principal: 'user',
    schemaId: 'schema',
    configId: 'config',
    baseRevision: f.authority.sha
  }
  const title = {title: 'Editor one'}
  const summary = {summary: 'Editor two'}
  const structure = {...entry, versionStatus: entry.status}
  const first: Mutation = {
    op: 'update',
    id: entry.id,
    locale: null,
    status: entry.status,
    set: title,
    precondition: await updatePrecondition(structure, entry.data, title)
  }
  const second: Mutation = {
    op: 'update',
    id: entry.id,
    locale: null,
    status: entry.status,
    set: summary,
    precondition: await updatePrecondition(structure, entry.data, summary)
  }
  await f.client.mutate([first], 'first', expected)
  const accepted = await f.client.mutate([second], 'second', expected)
  expect(
    f.authority.index.findFirst(entry => entry.id === 'entry')!.data
  ).toMatchObject({...title, ...summary})
  f.restart()
  expect(await f.client.mutate([second], 'second', expected)).toEqual(accepted)
  await expect(
    f.client.mutate([first], 'same-field', expected)
  ).rejects.toThrow('Field changed while editing')
  await expect(
    f.client.mutate(
      [{...second, precondition: undefined}],
      'unguarded',
      expected
    )
  ).rejects.toThrow('base revision changed')
  await f.client.mutate(
    [
      {
        op: 'update',
        id: entry.id,
        locale: null,
        status: entry.status,
        set: {path: 'moved'}
      }
    ],
    'move-path'
  )
  await expect(
    f.client.mutate([second], 'after-move', expected)
  ).rejects.toThrow('structure changed')
})
