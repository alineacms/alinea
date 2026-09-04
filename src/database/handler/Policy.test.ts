import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core.js'
import {role} from '#/core/Role.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {evaluateRolePolicy, policyFingerprint} from './Policy.js'
import {createRuntimeStore} from '#test/EntryFixture.js'

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
    const store = await createRuntimeStore(
      config,
      new FSSource('test/fixtures/demo')
    )
    const graph = new DatabaseResolver(config, store)
    const policy = await evaluateRolePolicy(config, graph, ['editor'])

    expect(policy.canRead({id: 'oi4qtV9YaXNRIUDT2s61Y'})).toBe(true)
    expect(policy.canRead({id: '2cGLQZvsCCxnguLrwCfPDL8uFkm'})).toBe(false)
    expect(await policyFingerprint(policy)).toMatch(/^[0-9a-f]{40}$/)
  })
})
