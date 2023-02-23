import {Pages} from 'alinea/backend/Pages'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import createExample from './fixture/Example'

test('tree', async () => {
  const {config, store} = await createExample()
  const pages = new Pages({
    schema: config.schema,
    async query(cursor) {
      return store.all(cursor)
    }
  })

  const root = await pages.first(page => page.id.is('root'))
  if (!root) throw new Error(`root expected`)

  const children = await root.tree.children()
  assert.is(children.length, 1)
  const [sub] = children
  assert.is(sub.id, 'sub')

  //const subRoot = await pages.fetchId<{list: Array<{link: any}>}>('sub')
  //console.log(subRoot!.list[0].link)

  const parents = await sub.tree.parents().select(parent => parent.id)
  assert.is(parents.length, 1)
  assert.is(parents[0], 'root')

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
