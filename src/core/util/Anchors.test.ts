import {suite} from '@alinea/suite'
import {
  applyUrlSuffix,
  createUniqueAnchor,
  isGeneratedAnchor,
  usedAnchors
} from './Anchors.js'

const test = suite(import.meta)

test('Create unique anchors', () => {
  const anchors = new Set<string>()

  test.is(createUniqueAnchor('heading', anchors), 'heading')
  test.is(createUniqueAnchor('heading', anchors), 'heading-2')
  test.is(createUniqueAnchor('heading', anchors), 'heading-3')
})

test('Recognize generated anchor suffixes', () => {
  test.is(isGeneratedAnchor(undefined, 'heading'), true)
  test.is(isGeneratedAnchor('heading', 'heading'), true)
  test.is(isGeneratedAnchor('heading-1', 'heading'), true)
  test.is(isGeneratedAnchor('heading-2', 'heading'), true)
  test.is(isGeneratedAnchor('heading-custom', 'heading'), false)
  test.is(isGeneratedAnchor('custom-2', 'heading'), false)
})

test('Ignore empty anchors', () => {
  const anchors = new Set<string>()

  test.is(createUniqueAnchor(undefined, anchors), undefined)
  test.is(createUniqueAnchor('', anchors), undefined)
  test.equal([...anchors], [])
})

test('Exclude the current anchor only when it is already unique', () => {
  test.equal([...usedAnchors(['intro', 'details'], 'intro')], ['details'])
  test.equal(
    [...usedAnchors(['intro', 'intro', 'details'], 'intro')],
    ['intro', 'details']
  )
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
