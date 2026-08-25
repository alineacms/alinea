import {expect, test} from 'bun:test'
import {invalidatedReplicaQueries} from './ReplicaDashboardDB.js'

test('invalidates only replica queries whose recorded dependencies changed', () => {
  const queries = new Map([
    ['children', new Set(['index:["entry.parent","parent\\u0000a"]'])],
    ['entry', new Set(['record:payload:a'])],
    ['eligible', new Set(['revision:*'])]
  ])

  expect(
    invalidatedReplicaQueries(queries, {
      dependencies: new Set([
        'index:["entry.parent","parent\\u0000a"]',
        'record:payload:unrelated'
      ])
    })
  ).toEqual(['children', 'eligible'])
})
