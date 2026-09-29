import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import {localisedFieldTab} from './LocalisedFieldTab.js'

const locales = ['en', 'nl', 'fr']

test('opens on the locale being edited', () => {
  const store = createStore()
  expect(store.get(localisedFieldTab(locales, 'entry', 'nl'))).toBe('nl')
  expect(store.get(localisedFieldTab(locales, 'entry', 'FR'))).toBe('fr')
})

test('falls back to the first locale', () => {
  const store = createStore()
  expect(store.get(localisedFieldTab(locales, 'entry', 'de'))).toBe('en')
  expect(store.get(localisedFieldTab(locales, 'entry', null))).toBe('en')
  expect(store.get(localisedFieldTab(locales, null, null))).toBe('en')
})

test('keeps a picked tab while editing the same entry locale', () => {
  const store = createStore()
  const tab = localisedFieldTab(locales, 'entry', 'nl')
  store.set(tab, 'fr')
  expect(store.get(tab)).toBe('fr')
  // Other localised fields with the same locales switch along
  expect(store.get(localisedFieldTab(locales, 'entry', 'nl'))).toBe('fr')
})

test('follows the entry locale again after switching locale or entry', () => {
  const store = createStore()
  store.set(localisedFieldTab(locales, 'entry', 'nl'), 'fr')
  expect(store.get(localisedFieldTab(locales, 'entry', 'en'))).toBe('en')
  expect(store.get(localisedFieldTab(locales, 'other', 'nl'))).toBe('nl')
})
