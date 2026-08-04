import {expect, test} from 'bun:test'
import {atom} from 'jotai'
import {Policy} from '#/core/Role.js'
import {localUser} from '#/core/User.js'
import type {Page} from './nav.js'
import {EntryAtoms, EntryLocaleAtoms, entryAtoms} from './entry.js'

test('entryAtoms returns stable entry and locale atom bundles', () => {
  const page: Page = {
    type: 'entry',
    workspace: 'workspace',
    root: 'pages',
    entry: 'entry-id',
    locale: null,
    auth: {user: localUser, policy: Policy.ALLOW_ALL}
  }
  const entry = new EntryAtoms('entry-id', atom({} as never), page.auth)

  expect(entry).toBeInstanceOf(EntryAtoms)
  expect(entryAtoms(page, 'entry-id')).toBe(entryAtoms(page, 'entry-id'))
  expect(entry.locales('en')).toBeInstanceOf(EntryLocaleAtoms)
  expect(entry.locales('en')).toBe(entry.locales('en'))
  expect(entry.locales('fr')).not.toBe(entry.locales('en'))
})
