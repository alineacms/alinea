import {parentUrl, walkUrl} from '@alinea/backend/util/Urls'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('url parents', () => {
  assert.equal(walkUrl('/'), ['/'])
  assert.equal(walkUrl('/data'), ['/', '/data'])
  assert.equal(walkUrl('/data/x/y'), ['/', '/data', '/data/x', '/data/x/y'])
})

test('url parent', () => {
  assert.is(parentUrl('/'), undefined)
  assert.is(parentUrl('/data'), '/')
  assert.is(parentUrl('/data/x/y'), '/data/x')
})

test.run()
