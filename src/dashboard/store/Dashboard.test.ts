import {suite} from '@alinea/suite'
import {createStore} from 'jotai/vanilla'
import {ReactiveNode} from './Dashboard.js'

const test = suite(import.meta)

interface Row {
  _id: string
  _type: string
}

function ids(rows: Array<Row>): Array<string> {
  return rows.map(row => row._id)
}

test('ReactiveNode inserts array values at the requested index', () => {
  const store = createStore()
  const node = new ReactiveNode<Array<Row>>([
    {_id: 'a', _type: 'item'},
    {_id: 'b', _type: 'item'}
  ])

  store.set(node.insert, 0, {_id: 'top', _type: 'item'})
  store.set(node.insert, 2, {_id: 'middle', _type: 'item'})
  store.set(node.insert, 99, {_id: 'end', _type: 'item'})

  test.equal(ids(store.get(node.value)), ['top', 'a', 'middle', 'b', 'end'])
})

