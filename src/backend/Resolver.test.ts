import {test} from 'uvu'
import {Example} from './test/Example.js'

test('create', async () => {
  const db1 = await Example.createDb()
  await db1.fill(Example.files())

  const {cms, schema} = Example
})

test.run()
