import {suite} from '@alinea/suite'
import {Client} from '#/core/Client.js'
import type {Config} from '#/core/Config.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {localUser} from '#/core/User.js'
import {createStore} from 'jotai/vanilla'
import {Dashboard, ReactiveNode} from './Dashboard.js'

const test = suite(import.meta)

interface Row {
  _id: string
  _type: string
}

function ids(rows: Array<Row>): Array<string> {
  return rows.map(row => row._id)
}

const config = {schema: {}, workspaces: {}} as Config

function createDashboard(options: {local?: boolean; alineaDev?: boolean}) {
  const client = new Client({config, url: 'https://example.com/api'})
  client.authStatus = () => {
    throw new Error('Local dashboard should not check auth status')
  }
  return new Dashboard(
    {} as WriteableGraph,
    config,
    new EventTarget(),
    client,
    {},
    options
  )
}

test('Dashboard does not require auth in local dev', async () => {
  const store = createStore()
  const dashboard = createDashboard({local: true})

  test.equal(store.get(dashboard.authRequired), false)
  test.equal(store.get(dashboard.auth).status, 'authenticated')
  test.equal(await store.get(dashboard.user), localUser)
})

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
