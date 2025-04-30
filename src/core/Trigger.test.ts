import {suite} from '@alinea/suite'
import {trigger} from './Trigger.js'

const test = suite(import.meta)

test('root', async () => {
  const number = trigger<number>()
  number.resolve(123)
  test.is(await number, 123)
})
