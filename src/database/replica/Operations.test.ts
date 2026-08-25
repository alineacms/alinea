import {describe, expect, test} from 'bun:test'
import {
  applyFieldOperations,
  hashFieldValue,
  type FieldOperationRecord
} from './Operations.js'

interface TestRecord extends FieldOperationRecord {
  kind: 'payload'
}

function records(data: Record<string, unknown>) {
  const record: TestRecord = {kind: 'payload', id: 'entry-1', data}
  return new Map([[record.id, record]])
}

describe('applyFieldOperations', () => {
  test('merges a stale transaction when its field path is unchanged', async () => {
    const titleHash = await hashFieldValue('Before')
    const staleBodyHash = await hashFieldValue('Old body')
    const result = await applyFieldOperations(
      {
        id: 'tx-1',
        baseRevision: 'old-revision',
        operations: [
          {
            kind: 'set',
            recordId: 'entry-1',
            path: '/title',
            baseHash: titleHash,
            value: 'After'
          },
          {
            kind: 'set',
            recordId: 'entry-1',
            path: '/body',
            baseHash: staleBodyHash,
            value: 'Local body'
          }
        ]
      },
      {records: records({title: 'Before', body: 'Remote body'})}
    )

    expect(result.records.get('entry-1')?.data).toEqual({
      title: 'After',
      body: 'Remote body'
    })
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].path).toBe('/body')
    expect(result.conflicts[0].remoteValue).toBe('Remote body')
  })

  test('treats rich text as one opaque field', async () => {
    const remote = [{_type: 'paragraph', text: 'Remote'}]
    const local = [{_type: 'paragraph', text: 'Local'}]
    const result = await applyFieldOperations(
      {
        id: 'tx-rich-text',
        baseRevision: 'old',
        operations: [
          {
            kind: 'set',
            recordId: 'entry-1',
            path: '/body',
            baseHash: await hashFieldValue([
              {_type: 'paragraph', text: 'Original'}
            ]),
            value: local
          }
        ]
      },
      {records: records({body: remote})}
    )

    expect(result.records.size).toBe(0)
    expect(result.conflicts[0]).toMatchObject({
      path: '/body',
      localValue: local,
      remoteValue: remote
    })
  })

  test('applies identity-based set and ordered-list operations', async () => {
    const initial = [
      {_id: 'a', _index: 'a0', title: 'A'},
      {_id: 'b', _index: 'a1', title: 'B'}
    ]
    const first = await applyFieldOperations(
      {
        id: 'tx-list',
        baseRevision: 'one',
        operations: [
          {
            kind: 'moveListItem',
            recordId: 'entry-1',
            path: '/items',
            baseHash: await hashFieldValue(initial),
            itemId: 'b',
            position: 'a00'
          }
        ]
      },
      {records: records({items: initial})}
    )
    const moved = first.records.get('entry-1')!
    const second = await applyFieldOperations(
      {
        id: 'tx-remove',
        baseRevision: 'two',
        operations: [
          {
            kind: 'removeSetItem',
            recordId: 'entry-1',
            path: '/items',
            baseHash: await hashFieldValue(moved.data.items),
            itemId: 'a'
          }
        ]
      },
      {records: new Map([[moved.id, moved]])}
    )

    expect(second.records.get('entry-1')?.data.items).toEqual([
      {_id: 'b', _index: 'a00', title: 'B'}
    ])
  })

  test('checks authorization before applying a matching operation', async () => {
    await expect(
      applyFieldOperations(
        {
          id: 'tx-denied',
          baseRevision: 'one',
          operations: [
            {
              kind: 'set',
              recordId: 'entry-1',
              path: '/title',
              baseHash: await hashFieldValue('Before'),
              value: 'After'
            }
          ]
        },
        {records: records({title: 'Before'}), authorize: () => false}
      )
    ).rejects.toThrow('not authorized')
  })
})
