import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core.js'
import {role} from '#/core/Role.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {buildEntryDatabase} from '../entry/Source.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {evaluateRolePolicy, roleFingerprint} from './Policy.js'

describe('evaluateRolePolicy', () => {
  test('runs graph-backed JavaScript roles only on the complete handler graph', async () => {
    const editor = role('Editor', {
      async permissions(policy, graph) {
        const ids = await graph.find({
          search: 'chocolate',
          select: Entry.id
        })
        policy.set(
          ...ids.map(id => ({
            id,
            allow: {read: true, explore: true}
          }))
        )
      }
    })
    const config = {...cms.config, roles: {editor}}
    const snapshot = await buildEntryDatabase(
      config,
      new FSSource('test/fixtures/demo')
    )
    const graph = new DatabaseResolver(config, snapshot)
    const policy = await evaluateRolePolicy(config, graph, ['editor'])

    expect(policy.canRead({id: 'oi4qtV9YaXNRIUDT2s61Y'})).toBe(true)
    expect(policy.canRead({id: '2cGLQZvsCCxnguLrwCfPDL8uFkm'})).toBe(false)
    expect(roleFingerprint(['editor', 'admin', 'editor'])).toBe('admin\0editor')
  })
})
