import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {Entry} from '#/core/Entry.js'
import {Permission, Policy, WritablePolicy, role} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {config, entry, Page} from '#test/sqlite-browser/config.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import {
  authorizedIndex,
  compiledPermissions,
  evaluateRolePolicy,
  policyFingerprint
} from './Policy.js'

test('SQL policy views compile denials and field actions without hydrating unreadable payloads', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const editor = role('Editor', {
    permissions(policy) {
      policy
        .allowAll()
        .set(
          {id: 'b', deny: {read: true, update: true}},
          {id: 'hidden', deny: {explore: true}},
          {field: Page.title, deny: {update: true}}
        )
    }
  })
  const runtime = new EntryRuntime({...config, roles: {editor}}, db, {
    load() {
      throw new Error('Index export must not hydrate')
    }
  })
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: ['a', 'b', 'hidden'].map(id => ({entry: entry(id), payloadId: id}))
  })
  const view = await authorizedIndex(runtime, ['editor'])
  expect(view.revision).toBe('r1')
  expect(view.entries.map(row => row.entry.id)).toEqual(['a', 'b'])
  expect(view.entries[0].payloadId).toBe('a')
  expect(view.entries[0].fields.title & Permission.Update).toBe(0)
  expect(view.entries[1].permissions & Permission.Read).toBe(0)
  expect(view.entries[1].permissions & Permission.Update).toBe(0)
  expect(view.entries[1]).not.toHaveProperty('payloadId')
  expect(JSON.stringify(view)).not.toContain('hidden')
  expect((await authorizedIndex(runtime, [])).entries).toEqual([])
  await expect(authorizedIndex(runtime, ['unknown'])).rejects.toThrow(
    'not found'
  )
})

test('graph-backed roles are reevaluated when a commit overlaps policy compilation', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const queried = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  let calls = 0
  const editor = role('Editor', {
    async permissions(policy, graph) {
      const ids = await graph.find({select: Entry.id})
      if (++calls === 1) {
        queried.resolve()
        await resume.promise
      }
      policy.set(...ids.map(id => ({id, allow: {read: true, explore: true}})))
    }
  })
  const runtime = new EntryRuntime({...config, roles: {editor}}, db)
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: [{entry: entry('a'), payloadId: 'a'}]
  })
  const pending = authorizedIndex(runtime, ['editor'])
  await queried.promise
  await runtime.apply({
    fromRevision: 'r1',
    toRevision: 'r2',
    entries: [{entry: entry('b'), payloadId: 'b'}]
  })
  resume.resolve()
  const view = await pending
  expect(calls).toBe(2)
  expect(view.revision).toBe('r2')
  expect(view.entries.map(row => row.entry.id)).toEqual(['a', 'b'])
})

test('policy fingerprints are detached, order independent and include denied field actions', async () => {
  const scope = getScope(config)
  const a = new WritablePolicy(scope).set(
    {id: 'a', allow: {read: true}},
    {id: 'b', allow: {explore: true}}
  )
  const b = new WritablePolicy(scope).set(
    {id: 'b', allow: {explore: true}},
    {id: 'a', allow: {read: true}}
  )
  expect(await policyFingerprint(a)).toBe(await policyFingerprint(b))
  const detached = a.data()
  detached.root = Permission.All
  detached.entries[0][1] = Permission.All
  expect(a.canUpdate({id: 'a'})).toBe(false)
  b.set({field: Page.title, deny: {update: true}})
  expect(await policyFingerprint(a)).not.toBe(await policyFingerprint(b))
  expect(compiledPermissions(Policy.ALLOW_ALL)).toBe(Permission.All)
  expect(compiledPermissions(Policy.ALLOW_NONE)).toBe(Permission.None)
})

test('field read denials cannot accidentally issue whole-entry payload grants', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const editor = role('Editor', {
    permissions(policy) {
      policy.allowAll().set({field: Page.title, deny: {read: true}})
    }
  })
  const runtime = new EntryRuntime({...config, roles: {editor}}, db)
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: [{entry: entry('a'), payloadId: 'secret'}]
  })
  await expect(authorizedIndex(runtime, ['editor'])).rejects.toThrow(
    'filtered entry payloads'
  )
  expect(
    (
      await evaluateRolePolicy({...config, roles: {editor}}, runtime, [
        'editor'
      ])
    ).check(Permission.Read, {type: 'Page', field: 'title'})
  ).toBe(false)
})
