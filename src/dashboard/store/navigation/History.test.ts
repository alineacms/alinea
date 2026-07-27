import {expect, test} from 'bun:test'
import {routeFromHash, routeHash} from './History.js'

test('parses entry routes from hashes', () => {
  expect(routeFromHash('#/entry/main/content:fr/entry-id')).toEqual({
    page: 'entry',
    workspace: 'main',
    root: 'content',
    locale: 'fr',
    entry: 'entry-id'
  })
})

test('round trips entry and users routes', () => {
  const entry = {
    page: 'entry',
    workspace: 'main',
    root: 'content',
    locale: 'fr',
    entry: 'entry-id'
  } as const
  const users = {page: 'users'} as const

  expect(routeFromHash(routeHash(entry))).toEqual(entry)
  expect(routeFromHash(routeHash(users))).toEqual(users)
})
