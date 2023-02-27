import * as path from 'alinea/core/util/Paths'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('contains', () => {
  assert.ok(
    path.contains(
      'C:\\projects\\alinea\\apps\\demo',
      'C:\\projects\\alinea\\apps\\demo\\src\\view\\channels\\home\\DemoHome.schema.ts'
    )
  )
})

test.run()
