import {expect, test} from 'bun:test'
import {entryStatus} from './EntryStatusIcon.js'

const label = (...args: Parameters<typeof entryStatus>) =>
  entryStatus(...args)?.label

test('published entries have no status', () => {
  expect(label({status: 'published', main: true, locale: null})).toBe(undefined)
  expect(label({locale: null})).toBe(undefined)
})

test('drafts are unpublished until their first publish', () => {
  expect(label({status: 'draft', main: true, locale: null})).toBe('Unpublished')
  expect(label({status: 'draft', main: false, locale: null})).toBe('Draft')
})

test('archived and untranslated entries', () => {
  expect(label({status: 'archived', locale: null})).toBe('Archived')
  expect(label({status: 'published', locale: 'en'}, 'fr')).toBe('Untranslated')
  expect(label({status: 'published', locale: 'fr'}, 'fr')).toBe(undefined)
})
