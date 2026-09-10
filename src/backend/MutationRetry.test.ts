import {expect, spyOn, test} from 'bun:test'
import {createCMS} from '#/core.js'
import {Client} from '#/core/Client.js'
import {transactionIdHeader, type RequestContext} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import type {CommitReceipt, CommitTransaction} from '#/core/db/CommitRequest.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {HttpError} from '#/core/HttpError.js'
import {Config} from '#/index.js'
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
    schema: {Page: Config.document('Page', {fields: {}})},
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
    principal: 'user',
    roles: ['admin'],
    lastTransaction: undefined as CommitTransaction | undefined
  }
  const key = (principal: string, tx: CommitTransaction) =>
    JSON.stringify([principal, tx.namespace, tx.epoch, tx.id])
  function handler() {
    const db = Object.assign(new LocalDB(cms.config), {
      replicaIdentity: binding ? async () => binding : undefined
    })
    const prepare = db.request.bind(db)
    db.request = (...args) => {
      state.prepares++
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
