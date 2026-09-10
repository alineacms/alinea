import {expect, test} from 'bun:test'
import {replicaBinding} from './ReplicaBinding.js'

test('dashboard bindings are explicit, detached and contain only public source scope', () => {
  const source = {
    project: 'project',
    namespace: 'preview/日本語',
    epoch: 'reset',
    principal: 'not-an-authentication-source',
    token: 'secret'
  }
  const decoded = replicaBinding(source)
  source.namespace = 'different'
  expect(decoded).toEqual({
    project: 'project',
    namespace: 'preview/日本語',
    epoch: 'reset'
  })
  for (const value of [
    undefined,
    '{}',
    {},
    {...decoded, epoch: ''},
    {...decoded, namespace: 1},
    {...decoded, project: 'x'.repeat(4097)}
  ])
    expect(() => replicaBinding(value)).toThrow('binding')
})
