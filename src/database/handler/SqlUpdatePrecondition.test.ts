import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {Config, Field} from '#/index.js'
import {Policy, Permission} from '#/core/Role.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import {updatePrecondition} from '#/core/db/UpdatePrecondition.js'
import type {UpdateMutation} from '#/core/db/Mutation.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {buildDatabase} from '../runtime/BuildDatabase.js'
import {reconcileDatabase} from '../runtime/ReconcileDatabase.js'
import {sqlMutationRequest} from './SqlMutationRequest.js'
import {openCheckpoint} from '../runtime/Checkpoint.js'
import {Entry} from '#/core/Entry.js'
import {ScopeKey} from '#/core/Scope.js'

const identity = {
  project: 'project',
  namespace: 'main',
  epoch: '1',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release'
}
function configuration(localized = false) {
  return {
    schema: {
      Page: Config.document('Page', {
        fields: {
          title: Field.text('Title'),
          summary: Field.text('Summary'),
          shared: Field.text('Shared', {shared: true})
        }
      })
    },
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {
          pages: Config.root(
            'Pages',
            localized ? {i18n: {locales: ['en', 'de']}} : {}
          )
        }
      })
    }
  }
}

test('SQL guarded updates merge independently, record read checks and roll back a conflicting batch', async () => {
  const config = configuration()
  const fixture = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Original'}
  ])
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await buildDatabase(config, db, fixture.source, identity)
  const entry = fixture.index.findFirst(entry => entry.id === 'a')!
  async function mutation(
    set: Record<string, unknown>
  ): Promise<UpdateMutation> {
    return {
      op: 'update',
      id: 'a',
      locale: null,
      status: 'published',
      set,
      precondition: await updatePrecondition(
        {...entry, versionStatus: entry.status},
        entry.data,
        set
      )
    }
  }
  const first = await mutation({title: 'First'})
  const second = await mutation({summary: 'Second'})
  await expect(
    sqlMutationRequest(
      config,
      db,
      identity,
      [first],
      new Policy(Permission.Update | Permission.Publish)
    )
  ).rejects.toThrow('Permission denied')
  const request = await sqlMutationRequest(
    config,
    db,
    identity,
    [first],
    Policy.ALLOW_ALL
  )
  expect(request.authorization).toContainEqual(
    expect.objectContaining({
      permission: Permission.Read,
      resource: expect.objectContaining({id: 'a', field: 'title'})
    })
  )
  await fixture.source.applyChanges(sourceChanges(request))
  await reconcileDatabase(config, db, fixture.source, identity)
  const before = (await fixture.source.getTree()).sha
  await expect(
    sqlMutationRequest(config, db, identity, [second, first], Policy.ALLOW_ALL)
  ).rejects.toThrow('Field changed while editing')
  expect((await fixture.source.getTree()).sha).toBe(before)
  const valid = await sqlMutationRequest(
    config,
    db,
    identity,
    [second],
    Policy.ALLOW_ALL
  )
  await fixture.source.applyChanges(sourceChanges(valid))
  await reconcileDatabase(config, db, fixture.source, identity)
  const {runtime} = await openCheckpoint(config, db, identity)
  expect(await runtime.get({id: 'a', select: Entry.data})).toMatchObject({
    title: 'First',
    summary: 'Second'
  })
})

test('localized updates preserve untouched shared fields and guard every propagated translation', async () => {
  const config = configuration(true)
  const fixture = await createEntryResolver(
    config,
    ['en', 'de'].map(locale => ({
      id: 'a',
      type: 'Page',
      index: 'a',
      locale,
      title: locale,
      data: {shared: locale === 'en' ? 'Original' : 'Concurrent'}
    }))
  )
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await buildDatabase(config, db, fixture.source, identity)
  const entry = fixture.index.findFirst(
    entry => entry.id === 'a' && entry.locale === 'en'
  )!
  const structure = {...entry, versionStatus: entry.status}
  const set = {title: 'Localized title'}
  const mutation: UpdateMutation = {
    op: 'update',
    id: 'a',
    locale: 'en',
    status: 'published',
    set,
    precondition: await updatePrecondition(structure, entry.data, set)
  }
  const request = await sqlMutationRequest(
    config,
    db,
    identity,
    [mutation],
    Policy.ALLOW_ALL
  )
  expect(request.changes).toHaveLength(1)
  const shared = {shared: 'New shared value'}
  await expect(
    sqlMutationRequest(
      config,
      db,
      identity,
      [
        {
          ...mutation,
          set: shared,
          precondition: await updatePrecondition(structure, entry.data, shared)
        }
      ],
      Policy.ALLOW_ALL
    )
  ).rejects.toThrow('Shared field changed while editing')
  const repaired = await sqlMutationRequest(
    config,
    db,
    identity,
    [
      {
        op: 'update',
        id: 'a',
        locale: 'de',
        status: 'published',
        set: {shared: 'Original'}
      }
    ],
    Policy.ALLOW_ALL
  )
  await fixture.source.applyChanges(sourceChanges(repaired))
  await reconcileDatabase(config, db, fixture.source, identity)
  const sharedMutation: UpdateMutation = {
    ...mutation,
    set: shared,
    precondition: await updatePrecondition(structure, entry.data, shared)
  }
  const restricted = Policy.fromData({
    root: Permission.All,
    entries: [[ScopeKey.locale('de'), Permission.Explicit | Permission.Read]]
  })
  await expect(
    sqlMutationRequest(config, db, identity, [sharedMutation], restricted)
  ).rejects.toThrow('Permission denied')
  const propagated = await sqlMutationRequest(
    config,
    db,
    identity,
    [sharedMutation],
    Policy.ALLOW_ALL
  )
  expect(propagated.changes).toHaveLength(2)
  expect(propagated.authorization).toContainEqual(
    expect.objectContaining({
      permission: Permission.Update,
      resource: expect.objectContaining({locale: 'de', field: 'shared'})
    })
  )
})
