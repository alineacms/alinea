import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {Permission, Policy, role} from '#/core/Role.js'
import {
  config,
  entry,
  Page,
  replicaIdentity
} from '#test/sqlite-browser/config.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import {authorizedIndex, evaluateRolePolicy} from '../handler/Policy.js'
import {CompiledPolicy} from './CompiledPolicy.js'
import {decodeBootstrap} from './DecodeBootstrap.js'

test('compiled UI checks preserve entry denials and generic creation without hidden-entry rules', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const scoped = {
    ...config,
    roles: {
      editor: role('Editor', {
        permissions(policy) {
          policy
            .allowAll()
            .set(
              {id: 'hidden', deny: {explore: true}},
              {id: 'readonly', deny: {update: true}}
            )
        }
      })
    }
  }
  const runtime = new EntryRuntime(scoped, db)
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: ['a', 'readonly', 'hidden'].map(id => ({
      entry: entry(id),
      payloadId: id,
      data: {title: id}
    }))
  })
  const view = await authorizedIndex(runtime, ['editor'])
  expect(JSON.stringify(view)).not.toContain('hidden')
  const bootstrap = decodeBootstrap(
    {version: 1, identity: {...replicaIdentity, viewId: view.viewId}, ...view},
    {
      project: replicaIdentity.project,
      namespace: replicaIdentity.namespace,
      principal: replicaIdentity.principal
    }
  )
  const client = new CompiledPolicy(bootstrap)
  const trusted = await evaluateRolePolicy(scoped, runtime, ['editor'])
  for (const resource of [
    undefined,
    {type: 'Page'},
    {type: 'Page', field: 'title'},
    entry('a'),
    {...entry('a'), field: 'title'},
    entry('readonly')
  ])
    for (let bit = 1; bit <= Permission.All; bit *= 2)
      expect(client.check(bit, resource)).toBe(trusted.check(bit, resource))
  expect(client.get({...entry('a'), field: 'title'}).update).toBe(true)
  expect(client.canRead({id: 'hidden'})).toBe(false)
  expect(client.canRead({id: 'a', field: 'unknown'})).toBe(true)
  expect(client.canRead({id: 'a', workspace: 'wrong'})).toBe(false)
  expect(() => client.data()).toThrow('not an authority')
  expect(client.equals(new CompiledPolicy(bootstrap))).toBe(true)
  expect(
    client.equals(new CompiledPolicy({...bootstrap, revision: 'r2'}))
  ).toBe(false)
})

test('serialized policy validation rejects malformed flags and duplicate rules', () => {
  for (const data of [
    null,
    {root: -1, entries: []},
    {root: 2 ** 40, entries: []},
    {
      root: 0,
      entries: [
        ['Entry.a', 1],
        ['Entry.a', 2]
      ]
    },
    {root: 0, entries: [['Entry.a', NaN]]}
  ])
    expect(() => Policy.fromData(data)).toThrow()
  const policy = Policy.fromData(Policy.ALLOW_ALL.data())
  expect(policy.equals(Policy.ALLOW_ALL)).toBe(true)
})

test('locale-unspecified checks cannot inherit a readable translation grant', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(
    {
      ...config,
      roles: {
        reader: role('Reader', {
          permissions(policy) {
            policy
              .allowAll()
              .set({locale: 'fr', deny: {read: true, update: true}})
          }
        })
      }
    },
    db
  )
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: ['en', 'fr'].map(locale => ({
      entry: {...entry('a'), locale},
      payloadId: locale,
      data: {title: locale}
    }))
  })
  const view = await authorizedIndex(runtime, ['reader'])
  const client = new CompiledPolicy({
    version: 1,
    identity: {...replicaIdentity, viewId: view.viewId},
    ...view
  })
  expect(client.canRead({id: 'a', locale: 'en'})).toBe(true)
  expect(client.canRead({id: 'a', locale: 'fr'})).toBe(false)
  expect(client.canRead({id: 'a'})).toBe(false)
  expect(client.canRead({id: 'a', locale: 'missing'})).toBe(false)
})
