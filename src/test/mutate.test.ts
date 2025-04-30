import {suite} from '@alinea/suite'
import {config, createExample} from './example.js'

const test = suite(import.meta)
const {Page} = config.schema

test('remove field contents', async () => {
  const db = await createExample()
  const entry = await db.create({
    type: Page,
    set: {title: 'xyz', name: 'test'}
  })
  const updated = await db.update({
    type: Page,
    id: entry._id,
    set: {name: undefined}
  })
  test.is(updated.title, 'xyz')
  test.is(updated.name, null)
})
