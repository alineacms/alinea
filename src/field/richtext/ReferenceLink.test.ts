import {suite} from '@alinea/suite'
import {Reference} from '#/core/Reference.js'
import {EntryReference} from '#/picker/entry/EntryReference.js'
import {attributesToReference, referenceToAttributes} from './ReferenceLink.js'

const test = suite(import.meta)

test('round trips an internal link anchor through editor attributes', () => {
  const reference: EntryReference = {
    [Reference.id]: 'link-1',
    [Reference.type]: 'entry',
    [EntryReference.entry]: 'entry-1',
    [EntryReference.anchor]: 'details',
    [EntryReference.suffix]: '?mode=preview'
  }

  const attributes = referenceToAttributes(reference)
  test.equal(attributes, {
    'data-id': 'link-1',
    'data-entry': 'entry-1',
    'data-anchor': 'details',
    'data-link': 'entry',
    'data-suffix': '?mode=preview',
    href: undefined,
    target: undefined
  })
  test.equal(attributesToReference(attributes), reference)
})

test('round trips an image reference through editor node attributes', () => {
  const reference: EntryReference = {
    [Reference.id]: 'image-1',
    [Reference.type]: 'image',
    [EntryReference.entry]: 'media-1'
  }

  const attributes = referenceToAttributes(reference)
  test.equal(attributes, {
    'data-id': 'image-1',
    'data-entry': 'media-1',
    'data-anchor': undefined,
    'data-link': 'image',
    'data-suffix': undefined,
    href: undefined,
    target: undefined
  })
  test.equal(
    attributesToReference({
      _id: 'image-1',
      _entry: 'media-1',
      _link: 'image'
    }),
    reference
  )
})
