import {suite} from '@alinea/suite'
import type {Entry} from 'alinea/core'
import {FieldIndex} from './FieldIndex.ts'

const nodes = [
  {id: 'a'} as Entry,
  {id: 'c'} as Entry,
  {id: 'a'} as Entry,
  {id: 'b'} as Entry,
  {id: 'd'} as Entry
]
const byId = new FieldIndex(nodes, 'id')

const test = suite(import.meta)

test('by id', async () => {
  test.equal(byId.get('a'), [{id: 'a'}, {id: 'a'}])
})

test('within range', async () => {
  test.equal(byId.within({gte: 'b', lt: 'd'}), [{id: 'b'}, {id: 'c'}])
})
