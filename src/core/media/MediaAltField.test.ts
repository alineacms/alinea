import {expect, test} from 'bun:test'
import {mediaAltText} from './MediaAltField.js'

test('selects media alt text for the requested locale with a fallback', () => {
  const alt = {en: 'English description', fr: 'Description française'}

  expect(mediaAltText(alt, 'fr')).toBe('Description française')
  expect(mediaAltText(alt, 'de')).toBe('English description')
  expect(mediaAltText('Plain description', 'fr')).toBe('Plain description')
  expect(mediaAltText(undefined, 'fr')).toBe('')
})
