import {expect, test} from 'bun:test'
import {readWithMutationContext} from './ReadWithMutationContext.js'
import type {MutationContext} from './MutationContext.js'

const original: MutationContext = {
  project: 'project',
  namespace: 'main',
  epoch: 'epoch',
  principal: 'user',
  schemaId: 'schema',
  configId: 'config',
  baseRevision: 'r1'
}

test('editor reads detach their context and reject a view change during hydration', async () => {
  const context = {...original}
  const graph = {mutationContext: () => context}
  const read = await readWithMutationContext(graph, async () => 'entry')
  context.baseRevision = 'r2'
  expect(read).toEqual({value: 'entry', context: original})
  await expect(
    readWithMutationContext(graph, async () => {
      context.configId = 'new-config'
      return 'entry'
    })
  ).rejects.toThrow('Source changed while loading editor')
})

test('trusted graphs without a replica context keep their existing read behavior', async () => {
  expect(
    await readWithMutationContext(
      {mutationContext: () => undefined},
      async () => 1
    )
  ).toEqual({value: 1, context: undefined})
})
