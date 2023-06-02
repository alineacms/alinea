import {Database} from 'alinea/backend/Database'
import {test} from 'uvu'
import {example} from './test/Example.js'

test('create', async () => {
  await example.generate()
  const db = new Database(await example.createStore('.'), example)
  const res1 = await example.find(example.schema.TypeA())
  console.log(res1)
})

test.run()
