import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {Config, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import {Policy} from '#/core/Role.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {isRecord} from '#/core/util/Objects.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {buildDatabase} from '../runtime/BuildDatabase.js'
import {openCheckpoint} from '../runtime/Checkpoint.js'
import {FrameTable} from '../release/FrameStore.js'
import {sqlMutationRequest} from './SqlMutationRequest.js'

const config = {
  schema: {
    Page: Config.document('Page', {
      contains: ['Page'],
      fields: {title: Field.text('Title')}
    })
  },
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages', {contains: ['Page']})}
    })
  }
}
const identity = {
  project: 'project',
  namespace: 'main',
  epoch: '1',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release'
}

const cases: Array<[string, Mutation]> = [
  [
    'rename',
    {
      op: 'update',
      id: 'a',
      locale: null,
      status: 'published',
      set: {path: 'renamed'}
    }
  ],
  ['publish', {op: 'publish', id: 'a', locale: null, status: 'draft'}],
  ['unpublish', {op: 'unpublish', id: 'a', locale: null}],
  ['archive', {op: 'archive', id: 'a', locale: null}],
  ['move', {op: 'move', id: 'a', target: 'b', dropPosition: 'on'}],
  ['remove', {op: 'remove', id: 'a', locale: null}]
]

function comparableRequest(request: CommitRequest) {
  return {
    fromSha: request.fromSha,
    description: request.description,
    changes: request.changes.map(change => {
      if (change.op !== 'addContent') return change
      // Alias row IDs are generated independently by each preparation.
      const contents = JSON.parse(change.contents, (key, value: unknown) =>
        isRecord(value) && value._type === 'alias'
          ? {...value, _id: 'generated'}
          : value
      )
      return {op: change.op, path: change.path, contents}
    })
  }
}

for (const [name, mutation] of cases) {
  test(`SQL ${name} preparation matches the Graph compiler's source request`, async () => {
    const fixture = await createEntryResolver(config, [
      {id: 'a', type: 'Page', index: 'a', title: 'Published'},
      {id: 'a', type: 'Page', index: 'a', title: 'Draft', status: 'draft'},
      {id: 'b', type: 'Page', index: 'b', title: 'Target'}
    ])
    using sqlite = new Database(':memory:')
    const db = connect(sqlite)
    await buildDatabase(config, db, fixture.source, identity)
    const before = await db.select().from(FrameTable)
    const legacy = await fixture.index.transaction(fixture.source)
    await legacy.apply([mutation])
    const request = await sqlMutationRequest(
      config,
      db,
      identity,
      [mutation],
      Policy.ALLOW_ALL
    )
    expect(comparableRequest(request)).toEqual(
      comparableRequest(await legacy.toRequest())
    )
    expect(
      (await openCheckpoint(config, db, identity)).descriptor.sourceSha
    ).toBe(request.fromSha)
    expect(await db.select().from(FrameTable)).toEqual(before)
    await fixture.source.applyChanges(sourceChanges(request))
    expect((await fixture.source.getTree()).sha).toBe(request.intoSha)
  })
}

test('SQL Graph mutation preparation sees earlier operations without committing them', async () => {
  const fixture = await createEntryResolver(config, [])
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await buildDatabase(config, db, fixture.source, identity)
  const mutations: Array<Mutation> = [
    {
      op: 'create',
      id: 'new',
      type: 'Page',
      locale: null,
      root: 'pages',
      data: {title: 'Original'}
    },
    {
      op: 'update',
      id: 'new',
      locale: null,
      status: 'published',
      set: {title: 'Updated'}
    }
  ]
  const legacy = await fixture.index.transaction(fixture.source)
  await legacy.apply(mutations)
  const expected = await legacy.toRequest()
  const request = await sqlMutationRequest(
    config,
    db,
    identity,
    mutations,
    Policy.ALLOW_ALL
  )
  expect(request).toEqual(expected)
  const reopened = await openCheckpoint(config, db, identity)
  expect(reopened.descriptor.sourceSha).toBe(request.fromSha)
  expect(await reopened.runtime.find({select: Entry.id})).toEqual([])
  expect(await db.select().from(FrameTable)).toEqual([])
  await fixture.source.applyChanges(sourceChanges(request))
  expect((await fixture.source.getTree()).sha).toBe(request.intoSha)
})

test('SQL mutation preparation rolls back earlier operations when a later operation fails', async () => {
  const fixture = await createEntryResolver(config, [])
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await buildDatabase(config, db, fixture.source, identity)
  const revision = (await fixture.source.getTree()).sha
  await expect(
    sqlMutationRequest(
      config,
      db,
      identity,
      [
        {
          op: 'create',
          id: 'new',
          type: 'Page',
          locale: null,
          root: 'pages',
          data: {title: 'Original'}
        },
        {
          op: 'update',
          id: 'missing',
          locale: null,
          status: 'published',
          set: {title: 'Updated'}
        }
      ],
      Policy.ALLOW_ALL
    )
  ).rejects.toThrow()
  const reopened = await openCheckpoint(config, db, identity)
  expect(reopened.descriptor.sourceSha).toBe(revision)
  expect(await reopened.runtime.find({select: Entry.id})).toEqual([])
  expect(await db.select().from(FrameTable)).toEqual([])
})
