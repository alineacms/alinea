import {expect, test} from 'bun:test'
import {decodeMutationContext} from './MutationContext.js'

const context = {
  project: 'project',
  namespace: 'preview/日本語',
  epoch: '1',
  principal: 'user',
  schemaId: 'schema',
  configId: 'config',
  baseRevision: 'base'
}

test('mutation context is bounded, complete, detached and safe for HTTP headers', () => {
  expect(decodeMutationContext(null)).toBeUndefined()
  const header = encodeURIComponent(JSON.stringify(context))
  expect(header).toMatch(/^[\x20-\x7e]+$/)
  expect(decodeMutationContext(header)).toEqual(context)
  for (const value of [
    '',
    '%',
    'not-json',
    'x'.repeat(8193),
    JSON.stringify({}),
    JSON.stringify([]),
    JSON.stringify({...context, extra: 'unexpected'}),
    JSON.stringify({...context, epoch: null}),
    JSON.stringify({...context, principal: ''}),
    JSON.stringify({...context, configId: 'x'.repeat(1025)})
  ])
    expect(() => decodeMutationContext(value)).toThrow()
})
