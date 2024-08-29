import {suite} from '@alinea/suite'
import {trigger} from './Trigger.js'

suite(import.meta, test => {
  test('root', async () => {
    const number = trigger<number>()
    number.resolve(123)
    test.is(await number, 123)
  })
})
