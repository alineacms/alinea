import {expect, spyOn, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {role} from '#/core/Role.js'
import {config, entry} from '#test/sqlite-browser/config.js'
import {entryVersionId} from '../entry/Schema.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import {FrameStore, buildFrames} from '../release/FrameStore.js'
import {decryptFrame} from '../replica/Frame.js'
import {authorizedIndex} from './Policy.js'
import {GrantService} from './Grants.js'

const binding = {
  project: 'project',
  namespace: 'main',
  epoch: 'epoch',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release'
}
const a = {versionId: entryVersionId('a', null, 'published'), payloadId: 'a'}
const b = {versionId: entryVersionId('b', null, 'published'), payloadId: 'b'}

test('grant issuance rechecks trusted roles, rejects whole invalid batches and notices policy-only changes', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  let revoked = false
  const reader = role('Reader', {
    permissions(policy) {
      policy.set(
        {allow: {read: true, explore: true}},
        {id: 'b', deny: {read: true}}
      )
      if (revoked) policy.set({id: 'a', deny: {read: true}})
    }
  })
  const runtime = new EntryRuntime({...config, roles: {reader}}, db)
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: ['a', 'b'].map(id => ({
      entry: entry(id),
      payloadId: id,
      data: {title: id}
    }))
  })
  await buildFrames(db, binding)
  const store = new FrameStore(db)
  const service = new GrantService(runtime, store, binding)
  const view = await authorizedIndex(runtime, ['reader'])
  const [grant] = await service.issue(['reader'], view, [a])
  const bytes = await store.ciphertext({...binding, ...a, kind: 'data'})
  expect(
    JSON.parse(
      new TextDecoder().decode(
        await decryptFrame(grant.descriptor, grant.descriptor, bytes, grant.key)
      )
    )
  ).toEqual({data: {title: 'a'}})
  const reads = spyOn(store, 'grant')
  try {
    await expect(service.issue(['reader'], view, [a, b])).rejects.toThrow(
      'denied'
    )
    await expect(service.issue(['reader'], view, [a, a])).rejects.toThrow(
      'Duplicate'
    )
    await expect(
      service.issue(['reader'], view, [{...a, payloadId: 'old'}])
    ).rejects.toThrow('denied')
    expect(reads).not.toHaveBeenCalled()
    revoked = true
    await expect(service.issue(['reader'], view, [a])).rejects.toThrow('Stale')
    const next = await authorizedIndex(runtime, ['reader'])
    expect(next.revision).toBe(view.revision)
    expect(next.viewId).not.toBe(view.viewId)
    await expect(service.issue(['reader'], next, [a])).rejects.toThrow('denied')
    expect(reads).not.toHaveBeenCalled()
  } finally {
    reads.mockRestore()
  }
})

test('a commit overlapping private key lookup invalidates the pending grant response', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const reader = role('Reader', {
    permissions(policy) {
      policy.allowAll()
    }
  })
  const runtime = new EntryRuntime({...config, roles: {reader}}, db)
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: [{entry: entry('a'), payloadId: 'a', data: {title: 'a'}}]
  })
  await buildFrames(db, binding)
  const store = new FrameStore(db)
  const original = store.grant.bind(store)
  const view = await authorizedIndex(runtime, ['reader'])
  const read = spyOn(store, 'grant').mockImplementation(async identity => {
    const grant = await original(identity)
    await runtime.apply({fromRevision: 'r1', toRevision: 'r2', entries: []})
    return grant
  })
  try {
    await expect(
      new GrantService(runtime, store, binding).issue(['reader'], view, [a])
    ).rejects.toThrow('Stale')
  } finally {
    read.mockRestore()
  }
})
