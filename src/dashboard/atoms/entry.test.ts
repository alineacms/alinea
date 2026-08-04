import {expect, test} from 'bun:test'
import {atom} from 'jotai'
import {EntryAtoms, EntryLocaleAtoms, entryAtoms} from './entry.js'

test('entryAtoms returns stable entry and locale atom bundles', () => {
  const entry = new EntryAtoms('entry-id', atom({} as never))

  expect(entry).toBeInstanceOf(EntryAtoms)
  expect(entryAtoms('entry-id')).toBe(entryAtoms('entry-id'))
  expect(entry.locales('en')).toBeInstanceOf(EntryLocaleAtoms)
  expect(entry.locales('en')).toBe(entry.locales('en'))
  expect(entry.locales('fr')).not.toBe(entry.locales('en'))
})
