import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Pages} from '../src/Pages'
import createExample from './fixture/Example'

test('tree', async () => {
  const {config, store} = await createExample()
  const pages = new Pages(config, config.workspaces.main, async () => store)

  const root = await pages.fetch(({id}) => id.is('root'))
  if (!root) throw new Error(`root expected`)

  const children = await root.tree.children()
  assert.is(children.length, 1)
  const [sub] = children
  assert.is(sub.id, 'sub')

  const entry1 = await sub.tree.children().first()
  if (!entry1) throw new Error(`entry expected`)
  assert.is(entry1.id, 'sub-entry-1')

  const next = await entry1.tree.nextSibling()
  if (!next) throw new Error(`next expected`)
  assert.is(next.id, 'sub-entry-2', 'next')

  const prev = await next.tree.prevSibling()
  if (!prev) throw new Error(`prev expected`)
  assert.is(prev.id, 'sub-entry-1', 'prev')

  assert.is(await prev.tree.prevSibling(), null)
})

test.run()
