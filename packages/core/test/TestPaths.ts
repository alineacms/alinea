import {test} from 'uvu'
import * as assert from 'uvu/assert'
import * as path from '../src/util/Paths'

test('contains', () => {
  assert.ok(
    path.contains(
      'C:\\projects\\alinea\\apps\\demo',
      'C:\\projects\\alinea\\apps\\demo\\src\\view\\channels\\home\\DemoHome.schema.ts'
    )
  )
})

test.run()
