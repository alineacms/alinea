import {expect, test} from 'bun:test'
import {
  applyFieldOperations,
  canonicalJson,
  FieldConflictError,
  hashFieldValue,
  snapshotTransaction,
  type FieldOperation
} from './Operations.js'

test('field CAS merges independent stale edits and rejects an entire conflicting transaction', async () => {
  const original = {title: 'old', description: 'original'}
  const records = new Map([['entry', original]])
  const title: FieldOperation = {
    kind: 'set',
    recordId: 'entry',
    path: '/title',
    baseHash: await hashFieldValue('old'),
    value: 'new'
  }
  const first = await applyFieldOperations(
    {id: 'one', baseRevision: 'old', operations: [title]},
    records,
    () => true
  )
  const description: FieldOperation = {
    kind: 'set',
    recordId: 'entry',
    path: '/description',
    baseHash: await hashFieldValue('original'),
    value: 'changed'
  }
  const second = await applyFieldOperations(
    {id: 'two', baseRevision: 'old', operations: [description]},
    first,
    () => true
  )
  expect(second.get('entry')).toEqual({title: 'new', description: 'changed'})
  await expect(
    applyFieldOperations(
      {id: 'three', baseRevision: 'old', operations: [description, title]},
      first,
      () => true
    )
  ).rejects.toBeInstanceOf(FieldConflictError)
  expect(first.get('entry')).toEqual({title: 'new', description: 'original'})
  expect(original).toEqual({title: 'old', description: 'original'})
  await expect(
    applyFieldOperations(
      {id: 'four', baseRevision: 'old', operations: [title]},
      records,
      () => false
    )
  ).rejects.toThrow('not authorized')
})

test('collection edits use stable IDs and collection hashes, not numeric array offsets', async () => {
  const items = [
    {_id: 'a', _index: 'a', value: 'first'},
    {_id: 'b', _index: 'b', value: 'second'}
  ]
  const records = new Map([['entry', {items}]])
  const move: FieldOperation = {
    kind: 'moveListItem',
    recordId: 'entry',
    path: '/items',
    baseHash: await hashFieldValue(items),
    itemId: 'b',
    position: '0'
  }
  const moved = await applyFieldOperations(
    {id: 'move', baseRevision: 'r', operations: [move]},
    records,
    () => true
  )
  expect(moved.get('entry')?.items).toEqual([
    items[0],
    {...items[1], _index: '0'}
  ])
  const added = await applyFieldOperations(
    {
      id: 'add',
      baseRevision: 'r',
      operations: [
        {
          kind: 'addSetItem',
          recordId: 'entry',
          path: '/items',
          baseHash: await hashFieldValue(moved.get('entry')?.items),
          itemId: 'c',
          value: {_id: 'cannot-override', value: 'third'}
        }
      ]
    },
    moved,
    () => true
  )
  expect(added.get('entry')?.items).toEqual([
    items[0],
    {...items[1], _index: '0'},
    {_id: 'c', value: 'third'}
  ])
  const removed = await applyFieldOperations(
    {
      id: 'remove-current',
      baseRevision: 'r',
      operations: [
        {
          kind: 'removeSetItem',
          recordId: 'entry',
          path: '/items',
          baseHash: await hashFieldValue(added.get('entry')?.items),
          itemId: 'a'
        }
      ]
    },
    added,
    () => true
  )
  expect(removed.get('entry')?.items).toEqual([
    {...items[1], _index: '0'},
    {_id: 'c', value: 'third'}
  ])
  await expect(
    applyFieldOperations(
      {
        id: 'remove',
        baseRevision: 'r',
        operations: [{...move, kind: 'removeSetItem', itemId: 'a'}]
      },
      moved,
      () => true
    )
  ).rejects.toBeInstanceOf(FieldConflictError)
  await expect(
    applyFieldOperations(
      {
        id: 'offset',
        baseRevision: 'r',
        operations: [
          {
            kind: 'set',
            recordId: 'entry',
            path: '/items/0/value',
            baseHash: null,
            value: 'bad'
          }
        ]
      },
      records,
      () => true
    )
  ).rejects.toThrow('not stable')
})

test('pointers, overlapping edits and non-JSON values fail before applying data', async () => {
  const operation: FieldOperation = {
    kind: 'set',
    recordId: 'entry',
    path: '/a',
    baseHash: null,
    value: 1
  }
  for (const path of [
    '',
    'a',
    '/__proto__/polluted',
    '/constructor/x',
    '/bad~escape'
  ])
    expect(() =>
      snapshotTransaction({
        id: 'test',
        baseRevision: 'r',
        operations: [{...operation, path}]
      })
    ).toThrow()
  expect(() =>
    snapshotTransaction({
      id: 'test',
      baseRevision: 'r',
      operations: [operation, {...operation, path: '/a/b'}]
    })
  ).toThrow('Overlapping')
  for (const value of [undefined, NaN, Infinity, new Date(), [undefined]])
    expect(() => canonicalJson(value)).toThrow()
  expect(await hashFieldValue({a: 1, b: 2})).toBe(
    await hashFieldValue({b: 2, a: 1})
  )
  expect(await hashFieldValue(undefined)).toBeNull()
  expect(await hashFieldValue(null)).not.toBeNull()
  const changed = await applyFieldOperations(
    {
      id: 'escaped',
      baseRevision: 'r',
      operations: [{...operation, path: '/a~1b/~0name'}]
    },
    new Map([['entry', {}]]),
    () => true
  )
  expect(changed.get('entry')).toEqual({'a/b': {'~name': 1}})
})
