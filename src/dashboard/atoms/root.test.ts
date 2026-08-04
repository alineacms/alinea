import {expect, test} from 'bun:test'
import type {RootData} from '#/core/Root.js'
import {atom, createStore} from 'jotai'
import {LucideFile} from '../icons.js'
import {RootAtoms, rootAtoms} from './root.js'

test('rootAtoms returns stable bundles per root and locale', () => {
  const english = rootAtoms('workspace', 'pages', 'en')

  expect(english).toBeInstanceOf(RootAtoms)
  expect(rootAtoms('workspace', 'pages', 'en')).toBe(english)
  expect(rootAtoms('workspace', 'pages', 'fr')).not.toBe(english)
  expect(rootAtoms('workspace', 'media', 'en')).not.toBe(english)
  expect(rootAtoms('other-workspace', 'pages', 'en')).not.toBe(english)
  expect(english.children(null)).toBe(english.explorer)
  expect(english.children('parent')).toBe(english.children('parent'))
  expect(english.children('parent')).not.toBe(english.explorer)
})

test('root icon uses the original file fallback', () => {
  const root = new RootAtoms(
    'workspace',
    'pages',
    null,
    atom<RootData>({label: 'Pages'})
  )

  expect(createStore().get(root.icon)).toBe(LucideFile)
})

test('tree expansion survives a locale bundle change', () => {
  const data = atom<RootData>({label: 'Pages'})
  const english = new RootAtoms('workspace', 'pages', 'en', data)
  const french = new RootAtoms('workspace', 'pages', 'fr', data)
  const store = createStore()

  store.set(english.treeExpandedKeys, new Set(['parent']))

  expect(store.get(french.treeExpandedKeys)).toEqual(new Set(['parent']))
})
