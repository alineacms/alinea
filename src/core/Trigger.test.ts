import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {trigger} from './Trigger.js'

test('root', async () => {
  const number = trigger<number>()
  number.resolve(123)
  assert.is(await number, 123)
})

test.run()
