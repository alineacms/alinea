import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core/Entry.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {DatabaseResolver} from '#/database/query/Resolver.js'
import {hashFieldValue} from '#/database/replica/Operations.js'
import {fieldTransactionForUpdates} from './ReplicaDashboardDB.js'
import {createRuntimeStore} from '#test/EntryFixture.js'

describe('fieldTransactionForUpdates', () => {
  test('translates updates to independently hashed field paths', async () => {
    const store = await createRuntimeStore(
      cms.config,
      new FSSource('test/fixtures/demo')
    )
    const resolver = new DatabaseResolver(cms.config, store)
    const entry = await resolver.resolve({
      status: 'preferPublished',
      first: true,
      select: Entry
    })
    if (!entry) throw new Error('Expected fixture entry')
    const transaction = await fieldTransactionForUpdates(
      resolver,
      store.revision,
      [
        {
          kind: 'updateEntry',
          id: entry.id,
          locale: entry.locale,
          status: entry.status,
          set: {title: 'Concurrent title', 'nested/key': {enabled: true}}
        }
      ],
      'transaction-1'
    )

    expect(transaction).toEqual({
      id: 'transaction-1',
      baseRevision: store.revision,
      operations: [
        {
          kind: 'set',
          recordId: `payload:${entry.filePath}`,
          path: '/title',
          baseHash: await hashFieldValue(entry.data.title),
          value: 'Concurrent title'
        },
        {
          kind: 'set',
          recordId: `payload:${entry.filePath}`,
          path: '/nested~1key',
          baseHash: await hashFieldValue(entry.data['nested/key']),
          value: {enabled: true}
        }
      ]
    })
  })

  test('leaves structural writes for the command transport', async () => {
    const store = await createRuntimeStore(
      cms.config,
      new FSSource('test/fixtures/demo')
    )
    const resolver = new DatabaseResolver(cms.config, store)
    expect(
      await fieldTransactionForUpdates(resolver, 'revision-1', [
        {kind: 'removeEntry', id: 'entry-1'}
      ])
    ).toBeUndefined()
  })
})
