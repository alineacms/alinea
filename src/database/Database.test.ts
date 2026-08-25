import {describe, expect, test} from 'bun:test'
import {DatabaseSchema, DatabaseSnapshot} from './Database.js'
import {DatabaseIndex} from './SecondaryIndex.js'

interface TestRecord {
  id: string
  parent: string | null
  rank: number
  title: string
  body: string
}

const byParent = new DatabaseIndex<TestRecord, string>({
  name: 'parent',
  project(record) {
    return [
      {
        key: record.parent ?? 'root',
        order: [record.rank],
        metadata: record.title
      }
    ]
  }
})

const schema = new DatabaseSchema<TestRecord>().add(byParent)

function record(
  id: string,
  parent: string | null,
  rank: number,
  title = id,
  body = ''
): TestRecord {
  return {id, parent, rank, title, body}
}

describe('DatabaseSnapshot', () => {
  test('builds deterministic covering indexes', () => {
    const database = new DatabaseSnapshot({
      schema,
      revision: 'one',
      records: [record('b', null, 2), record('a', null, 1)]
    })

    expect(database.scan(byParent, 'root')).toEqual([
      {id: 'a', order: [1], metadata: 'a'},
      {id: 'b', order: [2], metadata: 'b'}
    ])
  })

  test('applies changes without mutating the previous snapshot', () => {
    const before = new DatabaseSnapshot({
      schema,
      revision: 'one',
      records: [record('a', null, 1), record('b', null, 2)]
    })
    const {snapshot: after, changes} = before.apply('two', [
      {op: 'put', record: record('b', 'a', 2, 'Moved')},
      {op: 'put', record: record('c', null, 3)},
      {op: 'delete', id: 'a'}
    ])

    expect(before.scan(byParent, 'root').map(item => item.id)).toEqual([
      'a',
      'b'
    ])
    expect(after.scan(byParent, 'root').map(item => item.id)).toEqual(['c'])
    expect(after.scan(byParent, 'a')).toEqual([
      {id: 'b', order: [2], metadata: 'Moved'}
    ])
    expect([...changes.records]).toEqual(['b', 'c', 'a'])
    expect(changes.indexes).toEqual([
      {index: 'parent', key: 'root'},
      {index: 'parent', key: 'a'}
    ])
  })

  test('does not invalidate a covering index for payload-only changes', () => {
    const before = new DatabaseSnapshot({
      schema,
      revision: 'one',
      records: [record('a', null, 1, 'A', 'old')]
    })
    const {snapshot: after, changes} = before.apply('two', [
      {op: 'put', record: record('a', null, 1, 'A', 'new')}
    ])

    expect(after.get('a')?.body).toBe('new')
    expect(changes.indexes).toEqual([])
    expect([...changes.records]).toEqual(['a'])
  })

  test('collapses multiple changes to a record into the final operation', () => {
    const before = new DatabaseSnapshot({schema, revision: 'one'})
    const {snapshot, changes} = before.apply('two', [
      {op: 'put', record: record('a', null, 1)},
      {op: 'delete', id: 'a'}
    ])

    expect(snapshot.size).toBe(0)
    expect(changes.indexes).toEqual([])
    expect([...changes.records]).toEqual([])
  })

  test('seals the schema once a snapshot uses it', () => {
    const localSchema = new DatabaseSchema<TestRecord>().add(byParent)
    new DatabaseSnapshot({schema: localSchema, revision: 'one'})

    expect(() =>
      localSchema.add(
        new DatabaseIndex<TestRecord, string>({
          name: 'title',
          project(row) {
            return [{key: row.title, metadata: row.title}]
          }
        })
      )
    ).toThrow('Cannot add an index')
  })
})
