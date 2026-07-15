import {suite} from '@alinea/suite'
import {createUniqueAnchor} from './Anchors.js'

const test = suite(import.meta)

test('Create unique anchors', () => {
  const anchors = new Set<string>()

  test.is(createUniqueAnchor('heading', anchors), 'heading')
  test.is(createUniqueAnchor('heading', anchors), 'heading-1')
  test.is(createUniqueAnchor('heading', anchors), 'heading-2')
})

test('Ignore empty anchors', () => {
  const anchors = new Set<string>()

  test.is(createUniqueAnchor(undefined, anchors), undefined)
  test.is(createUniqueAnchor('', anchors), undefined)
  test.equal([...anchors], [])
})
