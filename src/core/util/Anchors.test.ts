import {suite} from '@alinea/suite'
import {applyUrlSuffix, createUniqueAnchor} from './Anchors.js'

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

test('Apply URL suffix and anchor', () => {
  test.is(
    applyUrlSuffix('/page', '?filter=active', 'details'),
    '/page?filter=active#details'
  )
  test.is(applyUrlSuffix('/page', '#legacy', undefined), '/page#legacy')
  test.is(
    applyUrlSuffix('/page', '?filter=active#legacy', '#details'),
    '/page?filter=active#details'
  )
  test.is(
    applyUrlSuffix(
      'https://example.com/page',
      '?filter=active#legacy',
      'details'
    ),
    'https://example.com/page?filter=active#details'
  )
})
