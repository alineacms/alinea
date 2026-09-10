import {expect, test} from 'bun:test'
import {Permission, Policy} from '../Role.js'
import {ScopeKey} from '../Scope.js'
import {
  MutationAuthorization,
  authorizeMutationReceipt,
  decodeMutationPermissions
} from './MutationAuthorization.js'

test('mutation authorization records detached, deduplicated checks without payloads', () => {
  const recorder = new MutationAuthorization(Policy.ALLOW_ALL)
  const entry = {
    workspace: 'main',
    root: 'pages',
    type: 'Page',
    id: 'entry',
    parents: ['parent'],
    locale: null,
    data: {secret: 'not a permission'}
  }
  recorder.assert(Permission.Update, entry)
  recorder.assert(Permission.Update, entry)
  recorder.assert(Permission.Update, {...entry, field: 'title'})
  recorder.assert(Permission.Publish, entry)
  recorder.assert(Permission.Upload)
  entry.parents.push('later')
  const checks = recorder.snapshot()
  expect(checks).toHaveLength(4)
  expect(checks[0]).toEqual({
    permission: Permission.Update,
    resource: {
      workspace: 'main',
      root: 'pages',
      type: 'Page',
      id: 'entry',
      parents: ['parent'],
      locale: null
    }
  })
  expect(JSON.stringify(checks)).not.toContain('secret')
  checks[0].resource!.parents!.push('external')
  expect(recorder.snapshot()[0].resource!.parents).toEqual(['parent'])
  const denied = new MutationAuthorization(Policy.ALLOW_NONE)
  expect(() => denied.assert(Permission.Update, entry)).toThrow(
    'Permission denied'
  )
  expect(denied.snapshot()).toEqual([])
})

test('saved checks use the fresh policy, including field and ancestor rules', () => {
  const recorder = new MutationAuthorization(Policy.ALLOW_ALL)
  recorder.assert(Permission.Update, {
    id: 'deleted-entry',
    parents: ['parent'],
    type: 'Page',
    field: 'title',
    locale: null
  })
  const checks = recorder.snapshot()
  const allowed = Policy.fromData({
    root: 0,
    entries: [[ScopeKey.entry('parent'), Permission.Update]]
  })
  expect(() => authorizeMutationReceipt(allowed, checks)).not.toThrow()
  expect(() => authorizeMutationReceipt(Policy.ALLOW_NONE, checks)).toThrow(
    'Permission denied'
  )
  const fieldRevoked = Policy.fromData({
    root: Permission.Update,
    entries: [[ScopeKey.field('Page', 'title'), Permission.Explicit]]
  })
  expect(() => authorizeMutationReceipt(fieldRevoked, checks)).toThrow(
    'Permission denied'
  )
})

test('malformed saved permissions cannot turn a receipt into an authorization bypass', () => {
  for (const value of [
    undefined,
    null,
    {},
    new Array(1),
    [{permission: 0}],
    [{permission: Permission.Explicit}],
    [{permission: 0.5}],
    [{permission: Permission.Update, resource: null}],
    [{permission: Permission.Update, resource: {data: {}}}],
    [{permission: Permission.Update, resource: {locale: 1}}],
    [{permission: Permission.Update, resource: {parents: new Array(1)}}]
  ])
    expect(() => authorizeMutationReceipt(Policy.ALLOW_ALL, value)).toThrow()
  const input = [
    {permission: Permission.Update, resource: {parents: ['parent']}}
  ]
  const decoded = decodeMutationPermissions(input)
  input[0].resource.parents.push('later')
  expect(decoded[0].resource!.parents).toEqual(['parent'])
})
