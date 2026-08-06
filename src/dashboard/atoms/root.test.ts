import {expect, test} from 'bun:test'
import type {RootData} from '#/core/Root.js'
import {Policy} from '#/core/Role.js'
import {localUser} from '#/core/User.js'
import type {Page} from './nav.js'
import {atom, createStore} from 'jotai'
import {LucideFile} from '../icons.js'
import {RootAtoms, rootAtoms} from './root.js'

test('rootAtoms returns stable bundles per root and locale', () => {
  const page = testPage()
  const english = rootAtoms(page, 'workspace', 'pages', 'en')

  expect(english).toBeInstanceOf(RootAtoms)
  expect(rootAtoms(page, 'workspace', 'pages', 'en')).toBe(english)
  expect(rootAtoms(page, 'workspace', 'pages', 'fr')).not.toBe(english)
  expect(rootAtoms(page, 'workspace', 'media', 'en')).not.toBe(english)
  expect(rootAtoms(page, 'other-workspace', 'pages', 'en')).not.toBe(english)
  expect(english.children(null)).toBe(english.explorer)
  expect(english.children('parent')).toBe(english.children('parent'))
  expect(english.children('parent')).not.toBe(english.explorer)
  expect(english.explorer.supportsInlineExpansion).toBe(false)
})

test('root icon uses the original file fallback', () => {
  const root = new RootAtoms(
    'workspace',
    'pages',
    null,
    atom<RootData>({label: 'Pages'}),
    Policy.ALLOW_ALL
  )

  expect(createStore().get(root.icon)).toBe(LucideFile)
})

test('tree expansion survives a locale bundle change', () => {
  const data = atom<RootData>({label: 'Pages'})
  const english = new RootAtoms(
    'workspace',
    'pages',
    'en',
    data,
    Policy.ALLOW_ALL
  )
  const french = new RootAtoms(
    'workspace',
    'pages',
    'fr',
    data,
    Policy.ALLOW_ALL
  )
  const store = createStore()

  store.set(english.treeExpandedKeys, new Set(['parent']))

  expect(store.get(french.treeExpandedKeys)).toEqual(new Set(['parent']))
})

function testPage(): Page {
  return {
    type: 'entry',
    workspace: 'workspace',
    root: 'pages',
    entry: undefined,
    locale: null,
    auth: {user: localUser, policy: Policy.ALLOW_ALL}
  }
}
