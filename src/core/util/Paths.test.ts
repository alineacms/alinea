import {suite} from '@alinea/suite'
import * as path from 'alinea/core/util/Paths'

const test = suite(import.meta)

test('contains', () => {
  test.ok(
    path.contains(
      'C:\\projects\\alinea\\apps\\demo',
      'C:\\projects\\alinea\\apps\\demo\\src\\view\\channels\\home\\DemoHome.schema.ts'
    )
  )
})
